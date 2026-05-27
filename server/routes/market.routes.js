const express = require('express');
const router = express.Router();
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// Map Groww's clean symbols to Yahoo Finance's NSE symbols
// E.g., "INTERGLOBE AVIATION LTD" -> "INDIGO.NS"
// In a full app, you might want a database collection for this mapping, but a simple function works for now.
const getYahooSymbol = (symbol) => {
    // Basic mapping for your specific stocks, you can expand this list!
    const symbolMap = {
        'INDIAN OIL CORP LTD': 'IOC.NS',
        'INTERGLOBE AVIATION LTD': 'INDIGO.NS',
        'NBCC (INDIA) LIMITED': 'NBCC.NS',
        'RELIANCE INDUSTRIES LTD': 'RELIANCE.NS',
        'ITC LTD': 'ITC.NS'
    };
    return symbolMap[symbol.toUpperCase()] || `${symbol.toUpperCase()}.NS`;
};

// GET /api/market/chart/:symbol?days=30
router.get('/chart/:symbol', async (req, res) => {
    try {
        const rawSymbol = req.params.symbol;
        const queryDays = parseInt(req.query.days) || 30; // Default to 1 month view
        const yahooSymbol = getYahooSymbol(rawSymbol);

        // 1. Calculate the date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - queryDays);

        // 2. Fetch the historical daily prices
        const historicalData = await yahooFinance.historical(yahooSymbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d'
        });

        // 3. Fetch the absolute live quote (for Unrealized P&L)
        const liveQuote = await yahooFinance.quote(yahooSymbol);

        // 4. Format the data perfectly for Recharts (React charting library)
        const chartData = historicalData.map(day => ({
            date: day.date.toISOString().split('T')[0], // e.g., "2024-05-14"
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
        res.status(500).json({ error: 'Failed to fetch live market data.' });
    }
});

module.exports = router;