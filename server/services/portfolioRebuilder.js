const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

/**
 * Rebuilds all holdings from scratch by replaying ALL transactions in FIFO order.
 * This is used after deleting a contract note to keep the portfolio consistent.
 */
const rebuildHoldings = async () => {
    // 1. Clear existing holdings
    await Holding.deleteMany({});

    // 2. Fetch all transactions sorted by date
    const transactions = await Transaction.find().sort({ tradeDate: 1 });

    // 3. Replay FIFO
    const holdingsMap = {}; // key: isin, value: holding object

    for (const tx of transactions) {
        const isin = tx.isin;
        if (!holdingsMap[isin]) {
            holdingsMap[isin] = {
                isin,
                symbol: tx.symbol,
                currentQuantity: 0,
                totalInvested: 0,
                averageBuyPrice: 0,
                realizedNetPnL: 0,
                realizedGrossPnL: 0,
                // we won't store fees per holding anymore
            };
        }
        const holding = holdingsMap[isin];

        if (tx.type === 'BUY') {
            holding.currentQuantity += tx.quantity;
            holding.totalInvested += tx.netValue; // netValue = grossValue now
            holding.averageBuyPrice = holding.currentQuantity > 0
                ? holding.totalInvested / holding.currentQuantity
                : 0;
        } else if (tx.type === 'SELL') {
            // FIFO: match against remaining BUY transactions
            let sharesToSell = tx.quantity;
            let costBasis = 0;
            // We need to find all BUY transactions for this ISIN with remainingQuantity > 0
            const buys = await Transaction.find({
                isin,
                type: 'BUY',
                remainingQuantity: { $gt: 0 }
            }).sort({ tradeDate: 1 });

            for (const buy of buys) {
                if (sharesToSell === 0) break;
                const taken = Math.min(sharesToSell, buy.remainingQuantity);
                costBasis += (buy.netValue / buy.quantity) * taken;
                buy.remainingQuantity -= taken;
                sharesToSell -= taken;
                await buy.save();
            }

            const realizedPnL = tx.netValue - costBasis;
            holding.realizedNetPnL += realizedPnL;
            holding.currentQuantity -= tx.quantity;
            holding.totalInvested -= costBasis;
            holding.averageBuyPrice = holding.currentQuantity > 0
                ? holding.totalInvested / holding.currentQuantity
                : 0;
        }
    }

    // 4. Save all holdings to DB
    for (const isin in holdingsMap) {
        const h = holdingsMap[isin];
        const newHolding = new Holding({
            isin: h.isin,
            symbol: h.symbol,
            currentQuantity: h.currentQuantity,
            totalInvested: h.totalInvested,
            averageBuyPrice: h.averageBuyPrice,
            realizedNetPnL: h.realizedNetPnL,
            realizedGrossPnL: h.realizedGrossPnL,
        });
        await newHolding.save();
    }
};

module.exports = { rebuildHoldings };