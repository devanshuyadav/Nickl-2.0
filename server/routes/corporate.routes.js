const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');

// POST /api/corporate/split
// Body expected: { symbol: 'RELIANCE', multiplier: 2 } 
router.post('/split', async (req, res) => {
    try {
        const { symbol, multiplier } = req.body;

        if (!symbol || !multiplier || multiplier <= 1) {
            return res.status(400).json({ error: 'Valid symbol and a multiplier > 1 are required.' });
        }

        const exactSymbol = symbol.toUpperCase().trim();

        // 1. Find the Master Holding
        const holding = await Holding.findOne({ symbol: exactSymbol });
        if (!holding) {
            return res.status(404).json({ error: `Holding for ${exactSymbol} not found.` });
        }

        // 2. Fetch the Active FIFO Queue (Only BUYs that haven't been sold yet)
        const activeBuys = await Transaction.find({
            symbol: exactSymbol,
            type: 'BUY',
            remainingQuantity: { $gt: 0 }
        });

        if (activeBuys.length === 0) {
            return res.status(400).json({ error: `No active shares found in the FIFO queue for ${exactSymbol}.` });
        }

        // 3. Mutate the FIFO Queue (The core math)
        for (let buy of activeBuys) {
            // If the trade originally had 10 shares, and 5 were already sold, we only multiply the remaining 5.
            const oldRemaining = buy.remainingQuantity;

            // Adjust the active queue
            buy.quantity = buy.quantity * multiplier;
            buy.remainingQuantity = buy.remainingQuantity * multiplier;
            buy.price = buy.price / multiplier;

            // NOTE: We DO NOT change grossValue, netValue, or taxes. 
            // The total money you paid for this batch of shares remains exactly the same!

            await buy.save();
        }

        // 4. Update the Master Holding Scoreboard
        // We only adjust the current active quantity. Total Invested remains exactly the same.
        holding.currentQuantity = holding.currentQuantity * multiplier;
        holding.averageBuyPrice = holding.totalInvested / holding.currentQuantity;

        await holding.save();

        res.status(200).json({
            message: `SUCCESS: ${exactSymbol} split processed perfectly! Multiplied active shares by ${multiplier}.`,
            newQuantity: holding.currentQuantity,
            newAvgPrice: Number(holding.averageBuyPrice.toFixed(2))
        });

    } catch (error) {
        console.error('Corporate Action Error:', error);
        res.status(500).json({ error: 'Failed to process corporate action.' });
    }
});

module.exports = router;