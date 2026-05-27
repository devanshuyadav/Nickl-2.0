const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');
const SymbolMap = require('../models/SymbolMap'); // Import the new model
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// POST /api/portfolio/symbol-map - Update or create a mapping from the client
router.post('/symbol-map', async (req, res) => {
    try {
        const { pdfSymbol, yahooSymbol } = req.body;
        if (!pdfSymbol || !yahooSymbol) {
            return res.status(400).json({ error: 'Both pdfSymbol and yahooSymbol are required.' });
        }

        const map = await SymbolMap.findOneAndUpdate(
            { pdfSymbol: pdfSymbol.toUpperCase().trim() },
            { yahooSymbol: yahooSymbol.toUpperCase().trim() },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Symbol map updated successfully!', map });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update symbol map.' });
    }
});

// GET /api/portfolio - The main dashboard aggregator
router.get('/', async (req, res) => {
    try {
        const holdings = await Holding.find().lean();

        // 1. Fetch all symbol mappings from DB
        const dbMaps = await SymbolMap.find().lean();
        const mappingObj = {};
        dbMaps.forEach(m => { mappingObj[m.pdfSymbol] = m.yahooSymbol; });

        // Helper function utilizing database data
        const getYahooSymbol = (symbol) => {
            return mappingObj[symbol.toUpperCase()] || `${symbol.toUpperCase()}.NS`;
        };

        // 2. Dynamic Tax Aggregation
        const feeAggregation = await Transaction.aggregate([
            {
                $group: {
                    _id: "$isin",
                    totalBrokerage: { $sum: "$brokerage" },
                    totalSTT: { $sum: "$stt" },
                    totalDpCharges: { $sum: "$dpCharges" },
                    totalOtherTaxes: { $sum: "$otherTaxes" }
                }
            }
        ]);

        const feeMap = {};
        feeAggregation.forEach(fee => { feeMap[fee._id] = fee; });

        // 3. Bulk Live Price Fetch
        const symbolsToFetch = holdings.map(h => getYahooSymbol(h.symbol));
        let liveQuotes = [];

        if (symbolsToFetch.length > 0) {
            try {
                liveQuotes = await yahooFinance.quote(symbolsToFetch);
            } catch (err) {
                console.error("Yahoo Finance bulk fetch warning:", err.message);
            }
        }

        const quoteMap = {};
        liveQuotes.forEach(q => { quoteMap[q.symbol] = q.regularMarketPrice; });

        // Portofolio calculations
        let totalInvested = 0, totalRealizedNetPnL = 0, totalUnrealizedPnL = 0, totalCurrentValuation = 0;
        let globalCharges = { brokerage: 0, stt: 0, dpCharges: 0, otherTaxes: 0, total: 0 };

        const enrichedHoldings = holdings.map(h => {
            const yahooSym = getYahooSymbol(h.symbol);
            const livePrice = quoteMap[yahooSym] || 0;

            const currentValuation = livePrice * h.currentQuantity;
            const unrealizedPnL = h.currentQuantity > 0 ? (currentValuation - h.totalInvested) : 0;
            const fees = feeMap[h.isin] || { totalBrokerage: 0, totalSTT: 0, totalDpCharges: 0, totalOtherTaxes: 0 };
            const stockTotalCharges = fees.totalBrokerage + fees.totalSTT + fees.totalDpCharges + fees.totalOtherTaxes;

            totalInvested += h.totalInvested;
            totalRealizedNetPnL += h.realizedNetPnL;
            totalCurrentValuation += currentValuation;
            totalUnrealizedPnL += unrealizedPnL;

            globalCharges.brokerage += fees.totalBrokerage;
            globalCharges.stt += fees.totalSTT;
            globalCharges.dpCharges += fees.totalDpCharges;
            globalCharges.otherTaxes += fees.totalOtherTaxes;
            globalCharges.total += stockTotalCharges;

            return {
                ...h,
                livePrice,
                currentValuation,
                unrealizedPnL,
                yahooSymbol: yahooSym,
                chargesBreakdown: {
                    brokerage: fees.totalBrokerage,
                    stt: fees.totalSTT,
                    dpCharges: fees.totalDpCharges,
                    otherTaxes: fees.totalOtherTaxes,
                    total: stockTotalCharges
                }
            };
        });

        res.status(200).json({
            summary: {
                totalInvested: Number(totalInvested.toFixed(2)),
                totalCurrentValuation: Number(totalCurrentValuation.toFixed(2)),
                totalRealizedNetPnL: Number(totalRealizedNetPnL.toFixed(2)),
                totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
                charges: {
                    brokerage: Number(globalCharges.brokerage.toFixed(2)),
                    stt: Number(globalCharges.stt.toFixed(2)),
                    dpCharges: Number(globalCharges.dpCharges.toFixed(2)),
                    otherTaxes: Number(globalCharges.otherTaxes.toFixed(2)),
                    total: Number(globalCharges.total.toFixed(2))
                }
            },
            holdings: enrichedHoldings
        });

    } catch (error) {
        console.error('Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio data.' });
    }
});

// DELETE /api/portfolio/reset - Wipe the entire database for testing
router.delete('/reset', async (req, res) => {
    try {
        await Holding.deleteMany({});
        await Transaction.deleteMany({});
        res.status(200).json({ message: 'SUCCESS: Portfolio completely wiped.' });
    } catch (error) {
        console.error('Reset Error:', error);
        res.status(500).json({ error: 'Failed to reset portfolio database.' });
    }
});

module.exports = router;