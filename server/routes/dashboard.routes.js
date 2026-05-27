const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding'); // Ensure this path matches your folder structure

// GET /api/portfolio (Mounted in server.js)
router.get('/', async (req, res) => {
    try {
        // Fetch all holdings, sorted by highest investment value
        const holdings = await Holding.find().sort({ totalInvested: -1 });

        // Calculate macro portfolio stats
        let totalInvested = 0;
        let totalRealizedNetPnL = 0;
        let totalBrokeragePaid = 0;

        holdings.forEach(h => {
            totalInvested += h.totalInvested;
            totalRealizedNetPnL += h.realizedNetPnL;
            totalBrokeragePaid += h.totalBrokeragePaid;
        });

        res.status(200).json({
            summary: {
                totalInvested: Number(totalInvested.toFixed(2)),
                totalRealizedNetPnL: Number(totalRealizedNetPnL.toFixed(2)),
                totalBrokeragePaid: Number(totalBrokeragePaid.toFixed(2))
            },
            holdings
        });
    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio data.' });
    }
});

module.exports = router;