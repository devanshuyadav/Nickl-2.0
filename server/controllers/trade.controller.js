const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');

const executeTrades = async (req, res) => {
    try {
        const { trades } = req.body;

        if (!trades || !Array.isArray(trades) || trades.length === 0) {
            return res.status(400).json({ error: 'No trades provided for execution.' });
        }

        // We sort the trades by Date automatically, just in case the frontend sends a mixed batch
        trades.sort((a, b) => new Date(a.tradeDate) - new Date(b.tradeDate));

        for (const trade of trades) {
            let holding = await Holding.findOne({ isin: trade.isin });
            if (!holding) {
                holding = new Holding({ isin: trade.isin, symbol: trade.symbol });
            }

            if (trade.type === 'BUY') {
                const newTx = new Transaction({ ...trade, remainingQuantity: trade.quantity });
                await newTx.save();

                holding.currentQuantity += trade.quantity;
                holding.totalInvested += trade.netValue;
                holding.averageBuyPrice = holding.totalInvested / holding.currentQuantity;
                holding.totalBrokeragePaid += trade.brokerage;
                holding.totalTaxesPaid += (trade.stt + trade.otherTaxes + (trade.dpCharges || 0));

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

                const newTx = new Transaction({ ...trade, remainingQuantity: 0 });
                await newTx.save();

                const realizedNetPnL = trade.netValue - totalFullyLoadedCostOfSoldShares;
                const realizedGrossPnL = trade.grossValue - totalGrossCostOfSoldShares;

                holding.currentQuantity -= trade.quantity;
                holding.totalInvested -= totalFullyLoadedCostOfSoldShares;
                holding.averageBuyPrice = holding.currentQuantity > 0 ? (holding.totalInvested / holding.currentQuantity) : 0;

                holding.realizedNetPnL = Number((holding.realizedNetPnL + realizedNetPnL).toFixed(2));
                holding.realizedGrossPnL = Number((holding.realizedGrossPnL + realizedGrossPnL).toFixed(2));
                holding.totalBrokeragePaid += trade.brokerage;
                holding.totalTaxesPaid += (trade.stt + trade.otherTaxes + (trade.dpCharges || 0));

                await holding.save();
            }
        }

        res.status(200).json({ message: 'Success! Trades executed and Database updated.' });

    } catch (error) {
        console.error('Execution Error:', error);
        res.status(500).json({ error: 'Internal server error during trade execution.' });
    }
};

module.exports = { executeTrades };