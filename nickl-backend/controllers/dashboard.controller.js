const Holding = require('../models/Holding');

const getPortfolio = async (req, res) => {
    try {
        // Fetch all holdings where you currently own shares, or have realized some P&L
        const holdings = await Holding.find({
            $or: [
                { currentQuantity: { $gt: 0 } },
                { realizedPnL: { $ne: 0 } }
            ]
        }).sort({ totalInvested: -1 }); // Sort by largest investment first

        // Calculate total portfolio metrics
        let totalInvested = 0;
        let totalRealizedPnL = 0;

        holdings.forEach(h => {
            totalInvested += h.totalInvested;
            totalRealizedPnL += h.realizedPnL;
        });

        res.status(200).json({
            metrics: {
                totalInvested,
                totalRealizedPnL
            },
            holdings
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio data.' });
    }
};

module.exports = { getPortfolio };