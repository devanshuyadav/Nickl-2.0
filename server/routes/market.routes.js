const express = require('express');
const router = express.Router();
const SymbolMap = require('../models/SymbolMap'); // Import the DB model
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// GET /api/market/chart/:symbol?days=30
router.get('/chart/:symbol', async (req, res) => {
    try {
        const rawSymbol = req.params.symbol;
        const queryDays = parseInt(req.query.days) || 30;

        // 1. Fetch mapping from Database dynamically
        const mapping = await SymbolMap.findOne({ pdfSymbol: rawSymbol.toUpperCase().trim() });
        const yahooSymbol = mapping ? mapping.yahooSymbol : `${rawSymbol.toUpperCase().trim()}.NS`;

        // 2. Calculate the date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - queryDays);

        // 3. Fetch the historical daily prices
        const historicalData = await yahooFinance.historical(yahooSymbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        // 4. Fetch the absolute live quote
        const liveQuote = await yahooFinance.quote(yahooSymbol);

        // 5. Format the data perfectly for Recharts
        const chartData = historicalData.map(day => ({
            date: day.date.toISOString().split('T')[0],
            price: Number(day.close.toFixed(2))
        }));

        res.status(200).json({
            symbol: rawSymbol,
            yahooSymbol,
            livePrice: liveQuote.regularMarketPrice,
            currency: liveQuote.currency,
            chartData
        });

    } catch (error) {
        console.error(`Market Data Error for ${req.params.symbol}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch live market data. Check if the Yahoo Ticker is correct.' });
    }
});

module.exports = router;