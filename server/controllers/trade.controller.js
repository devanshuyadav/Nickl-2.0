const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');

const executeTrades = async (req, res) => {
    try {
        const { transactions } = req.body;

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ error: 'No trades provided for execution.' });
        }

        const ContractNote = require('../models/ContractNote')
        const existing = await ContractNote.findOne({ tradeDate: req.body.tradeDate });
        if (existing) {
            return res.status(409).json({
                error: `Contract note already exists in the database. Duplicate uploads are not allowed.`
            });
        }

        // ✅ VALIDATE SUFFICIENT QUANTITY FOR SELLS
        const validationErrors = [];
        const isinMap = {};

        for (const trade of transactions) {
            const isin = trade.isin;
            const symbol = trade.symbol;

            // Initialize tracking for this ISIN if not present
            if (!isinMap[isin]) {
                const holding = await Holding.findOne({ isin });
                const currentQuantity = holding ? holding.currentQuantity : 0;
                isinMap[isin] = {
                    symbol,
                    availableQuantity: currentQuantity,
                    buysInBatch: 0,
                    sellsInBatch: 0,
                };
            }

            if (trade.type === 'BUY') {
                isinMap[isin].availableQuantity += trade.quantity;
                isinMap[isin].buysInBatch += trade.quantity;
            } else if (trade.type === 'SELL') {
                isinMap[isin].sellsInBatch += trade.quantity;
                
                // Check if this sell would exceed available quantity
                if (trade.quantity > isinMap[isin].availableQuantity) {
                    validationErrors.push({
                        symbol,
                        isin,
                        sellQuantity: trade.quantity,
                        availableQuantity: isinMap[isin].availableQuantity,
                        deficit: trade.quantity - isinMap[isin].availableQuantity,
                        buyInBatch: isinMap[isin].buysInBatch,
                        sellInBatch: isinMap[isin].sellsInBatch,
                    });
                }
                
                // Decrease available quantity for subsequent sells (simulate FIFO)
                isinMap[isin].availableQuantity -= trade.quantity;
            }
        }

        // If there are validation errors, return detailed error
        if (validationErrors.length > 0) {
            const errorMessages = validationErrors.map(err => {
                let message = `❌ ${err.symbol}: Cannot sell ${err.sellQuantity} shares. `;
                
                if (err.buyInBatch > 0) {
                    message += `(You're buying ${err.buyInBatch} shares in this batch. `;
                }
                
                message += `Available quantity: ${err.availableQuantity}. Need ${err.deficit} more shares.)`;
                
                return message;
            });

            return res.status(400).json({
                error: 'Insufficient quantity to execute SELL trades.',
                details: errorMessages,
            });
        }

        // PROCEED WITH TRADE EXECUTION
        // We sort the trades by Date automatically, just in case the frontend sends a mixed batch
        transactions.sort((a, b) => new Date(a.tradeDate) - new Date(b.tradeDate));

        for (const trade of transactions) {
            let holding = await Holding.findOne({ isin: trade.isin });
            if (!holding) {
                holding = new Holding({ isin: trade.isin, symbol: trade.symbol });
            }

            if (trade.type === 'BUY') {
                // Explicitly construct the transaction object – no fee fields.
                const newTx = new Transaction({
                    isin: trade.isin,
                    symbol: trade.symbol,
                    tradeDate: trade.tradeDate,
                    type: 'BUY',
                    quantity: trade.quantity,
                    price: trade.price,
                    grossValue: trade.grossValue,
                    netValue: trade.netValue,       // equals grossValue now
                    remainingQuantity: trade.quantity
                });
                await newTx.save();

                holding.currentQuantity += trade.quantity;
                holding.totalInvested += trade.netValue;
                holding.averageBuyPrice = holding.totalInvested / holding.currentQuantity;
                // We NO LONGER update brokerage/taxes per holding.

                await holding.save();

            } else if (trade.type === 'SELL') {
                let sharesToSell = trade.quantity;
                let totalFullyLoadedCostOfSoldShares = 0;
                let totalGrossCostOfSoldShares = 0;

                const availableBuys = await Transaction.find({
                    isin: trade.isin,
                    type: 'BUY',
                    remainingQuantity: { $gt: 0 }
                }).sort({ tradeDate: 1 });

                for (const buy of availableBuys) {
                    if (sharesToSell === 0) break;
                    const sharesTaken = Math.min(sharesToSell, buy.remainingQuantity);

                    totalFullyLoadedCostOfSoldShares += (buy.netValue / buy.quantity) * sharesTaken;
                    totalGrossCostOfSoldShares += buy.price * sharesTaken;

                    buy.remainingQuantity -= sharesTaken;
                    sharesToSell -= sharesTaken;
                    await buy.save();
                }

                if (sharesToSell > 0) {
                    console.warn(`WARNING: Sold ${sharesToSell} more shares of ${trade.symbol} than found in DB. Cost basis for these shares will be calculated as 0.`);
                }

                // Explicitly construct the sell transaction – no fee fields.
                const newTx = new Transaction({
                    isin: trade.isin,
                    symbol: trade.symbol,
                    tradeDate: trade.tradeDate,
                    type: 'SELL',
                    quantity: trade.quantity,
                    price: trade.price,
                    grossValue: trade.grossValue,
                    netValue: trade.netValue,       // equals grossValue now
                    remainingQuantity: 0
                });
                await newTx.save();

                const realizedNetPnL = trade.netValue - totalFullyLoadedCostOfSoldShares;
                const realizedGrossPnL = trade.grossValue - totalGrossCostOfSoldShares;

                holding.currentQuantity -= trade.quantity;
                holding.totalInvested -= totalFullyLoadedCostOfSoldShares;
                holding.averageBuyPrice = holding.currentQuantity > 0 ? (holding.totalInvested / holding.currentQuantity) : 0;

                holding.realizedNetPnL = Number((holding.realizedNetPnL + realizedNetPnL).toFixed(2));
                holding.realizedGrossPnL = Number((holding.realizedGrossPnL + realizedGrossPnL).toFixed(2));

                await holding.save();
            }
        }

        // Save the daily summary to ContractNote
        if (req.body.summary) {
            const summary = req.body.summary;
            const totalOtherTaxes = (summary.cgst || 0) + (summary.sgst || 0) + (summary.igst || 0) +
                (summary.utt || 0) + (summary.sebiFees || 0) + (summary.stampDuty || 0) +
                (summary.ipft || 0);

            await ContractNote.findOneAndUpdate(
                { tradeDate: req.body.tradeDate },
                {
                    tradeDate: req.body.tradeDate,
                    dailyTurnover: summary.dailyTurnover || 0,
                    totalBrokerage: summary.totalBrokerage || 0,
                    totalSTT: summary.stt || 0,
                    totalDPCharge: summary.dp || 0,
                    totalOtherTaxes: totalOtherTaxes,
                    netCashFlow: summary.finalNetCashFlow || 0,
                },
                { upsert: true, returnDocument: 'after' }
            );
        }

        res.status(200).json({ message: 'Success! Trades executed and Database updated.' });

    } catch (error) {
        console.error('Execution Error:', error);
        res.status(500).json({ error: 'Internal server error during trade execution.' });
    }
};

module.exports = { executeTrades };