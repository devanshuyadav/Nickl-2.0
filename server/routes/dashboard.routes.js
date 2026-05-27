const express = require('express');
const router = express.Router();
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction'); // Import Transactions for tax math
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

const getYahooSymbol = (symbol) => {
    const symbolMap = {
        'INDIAN OIL CORP LTD': 'IOC.NS',
        'INTERGLOBE AVIATION LTD': 'INDIGO.NS',
        'NBCC (INDIA) LIMITED': 'NBCC.NS',
        'RELIANCE INDUSTRIES LTD': 'RELIANCE.NS',
        'ITC LTD': 'ITC.NS'
    };
    return symbolMap[symbol.toUpperCase()] || `${symbol.toUpperCase()}.NS`;
};

router.get('/', async (req, res) => {
    try {
        const holdings = await Holding.find().lean(); // .lean() makes it plain JS objects so we can edit them

        // 1. Dynamic Tax Aggregation Pipeline
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

        // 2. Bulk Yahoo Finance Fetch
        const symbolsToFetch = holdings.map(h => getYahooSymbol(h.symbol));
        let liveQuotes = [];

        if (symbolsToFetch.length > 0) {
            try {
                // Fetch all live quotes at once!
                liveQuotes = await yahooFinance.quote(symbolsToFetch);
            } catch (err) {
                console.error("Yahoo Finance bulk fetch warning:", err.message);
            }
        }

        const quoteMap = {};
        liveQuotes.forEach(q => { quoteMap[q.symbol] = q.regularMarketPrice; });

        // Portfolio-wide global trackers
        let totalInvested = 0, totalRealizedNetPnL = 0, totalUnrealizedPnL = 0, totalCurrentValuation = 0;
        let globalCharges = { brokerage: 0, stt: 0, dpCharges: 0, otherTaxes: 0, total: 0 };

        // 3. Enrich the data
        const enrichedHoldings = holdings.map(h => {
            const yahooSym = getYahooSymbol(h.symbol);
            const livePrice = quoteMap[yahooSym] || 0; // Fallback to 0 if market data fails

            const currentValuation = livePrice * h.currentQuantity;
            const unrealizedPnL = h.currentQuantity > 0 ? (currentValuation - h.totalInvested) : 0;
            const fees = feeMap[h.isin] || { totalBrokerage: 0, totalSTT: 0, totalDpCharges: 0, totalOtherTaxes: 0 };
            const stockTotalCharges = fees.totalBrokerage + fees.totalSTT + fees.totalDpCharges + fees.totalOtherTaxes;

            // Add to global totals
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

module.exports = router;