const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const processContractNote = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });

        const panPassword = process.env.PDF_PASSWORD;
        if (!panPassword) return res.status(500).json({ error: 'PDF_PASSWORD is not set.' });

        // 1. Crack the PDF
        const dataBuffer = new Uint8Array(req.file.buffer);
        const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            password: panPassword,
            useSystemFonts: true
        });

        const pdfDocument = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + "\n";
        }

        // 2. Extract Trade Date
        const dateMatch = fullText.match(/Trade Date\s+(\d{2}-\d{2}-\d{4})/i);
        const tradeDateStr = dateMatch ? dateMatch[1].split('-').reverse().join('-') : null;
        const tradeDate = tradeDateStr ? new Date(tradeDateStr) : new Date();

        // 3. Bulletproof Tax & Fee Extraction
        const sanitizedText = fullText.replace(/\(\d+% on Brokerage.*?\)/gi, '');

        const getTax = (keyword) => {
            const index = sanitizedText.toLowerCase().indexOf(keyword.toLowerCase());
            if (index === -1) return 0;

            const chunk = sanitizedText.substring(index + keyword.length, index + keyword.length + 150);
            const numRegex = /[-]?\d+(?:\.\d+)?(?!\s*%)/g;
            const nums = chunk.match(numRegex);

            if (nums && nums.length > 0) {
                return Math.abs(parseFloat(nums[0].replace(/,/g, '')));
            }
            return 0;
        };

        const totalSTT = getTax('Securities Transaction Tax');
        const exchangeCharges = getTax('Exchange Transaction Charges');
        const sebiFees = getTax('SEBI Turnover Fees');
        const stampDuty = getTax('Stamp Duty');
        const cgst = getTax('CGST');
        const sgst = getTax('SGST');
        const igst = getTax('IGST');
        const ipftCharges = getTax('IPFT Charges');
        const utt = getTax('UTT');

        const totalOtherTaxes = Number((exchangeCharges + sebiFees + stampDuty + cgst + sgst + igst + ipftCharges + utt).toFixed(2));

        // 3.5 Extract DP Charges
        let totalDpCharges = 0;
        let dpIndex = sanitizedText.toLowerCase().indexOf('cdsl dp charges');
        if (dpIndex === -1) dpIndex = sanitizedText.toLowerCase().indexOf('groww dp charges');

        if (dpIndex !== -1) {
            const chunk = sanitizedText.substring(dpIndex, dpIndex + 400);
            const totalMatch = chunk.match(/Total\s+([\d,]+\.\d+)/i);
            if (totalMatch) {
                totalDpCharges = Math.abs(parseFloat(totalMatch[1].replace(/,/g, '')));
            }
        }

        // 4. Parse Individual Trades
        const extractedTrades = [];
        let dailyTurnover = 0;
        let sellTurnover = 0;
        let totalBrokerage = 0;
        let payInPayOut = 0;

        const tradeRegex = /(IN[A-Z0-9]{10})\s+([A-Za-z0-9\s\.\-\&\(\)\',]+?)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)/g;

        let match;
        while ((match = tradeRegex.exec(fullText)) !== null) {
            const isin = match[1];
            const symbol = match[2].trim();

            // BUY Trades
            const buyQty = Math.abs(parseInt(match[3], 10));
            if (buyQty > 0) {
                const valueIncludesBrokerage = Math.abs(parseFloat(match[7]));
                const tradeBrokerage = Math.abs(parseFloat(match[5])) * buyQty;
                const grossValue = valueIncludesBrokerage - tradeBrokerage;

                dailyTurnover += grossValue;
                totalBrokerage += tradeBrokerage;
                payInPayOut -= grossValue;

                extractedTrades.push({
                    isin, symbol, type: 'BUY', quantity: buyQty,
                    price: Math.abs(parseFloat(match[4])),
                    brokerage: Number(tradeBrokerage.toFixed(4)),
                    grossValue: grossValue
                });
            }

            // SELL Trades
            const sellQty = Math.abs(parseInt(match[8], 10));
            if (sellQty > 0) {
                const valueIncludesBrokerage = Math.abs(parseFloat(match[12]));
                const tradeBrokerage = Math.abs(parseFloat(match[10])) * sellQty;
                const grossValue = valueIncludesBrokerage + tradeBrokerage;

                dailyTurnover += grossValue;
                sellTurnover += grossValue;
                totalBrokerage += tradeBrokerage;
                payInPayOut += grossValue;

                extractedTrades.push({
                    isin, symbol, type: 'SELL', quantity: sellQty,
                    price: Math.abs(parseFloat(match[9])),
                    brokerage: Number(tradeBrokerage.toFixed(4)),
                    grossValue: grossValue
                });
            }
        }

        // 5. Apportion Taxes & Calculate Final NET VALUE
        const processedTrades = extractedTrades.map(trade => {
            const proportion = dailyTurnover > 0 ? (trade.grossValue / dailyTurnover) : 0;

            const apportionedSTT = Number((totalSTT * proportion).toFixed(2));
            const apportionedOtherTaxes = Number((totalOtherTaxes * proportion).toFixed(2));
            let apportionedDp = 0;
            let netValue = 0;

            if (trade.type === 'BUY') {
                netValue = trade.grossValue + trade.brokerage + apportionedSTT + apportionedOtherTaxes;
            } else {
                const sellProportion = sellTurnover > 0 ? (trade.grossValue / sellTurnover) : 0;
                apportionedDp = Number((totalDpCharges * sellProportion).toFixed(2));

                netValue = trade.grossValue - trade.brokerage - apportionedSTT - apportionedOtherTaxes - apportionedDp;
            }

            return {
                isin: trade.isin,
                symbol: trade.symbol,
                tradeDate,
                type: trade.type,
                quantity: trade.quantity,
                price: trade.price,
                brokerage: trade.brokerage,
                stt: apportionedSTT,
                otherTaxes: apportionedOtherTaxes,
                dpCharges: apportionedDp,
                grossValue: trade.grossValue,
                netValue: Number(netValue.toFixed(2))
            };
        });

        // 1. What the main page of the Contract Note says
        const netAmountReceivablePayable = Number((payInPayOut - totalBrokerage - totalSTT - totalOtherTaxes).toFixed(2));

        // 2. The True Cash Flow (Main Page - DP Charges from the Annexure)
        const finalNetCashFlow = Number((netAmountReceivablePayable - totalDpCharges).toFixed(2));

        // --- PHASE 2: The FIFO Execution Engine & Database Save ---
        for (const trade of processedTrades) {
            // 1. Find or create the master Holding scoreboard for this stock
            let holding = await Holding.findOne({ isin: trade.isin });
            if (!holding) {
                holding = new Holding({ isin: trade.isin, symbol: trade.symbol });
            }

            if (trade.type === 'BUY') {
                // Save the BUY transaction
                const newTx = new Transaction({
                    ...trade,
                    remainingQuantity: trade.quantity // These shares are now in the queue
                });
                await newTx.save();

                // Update the master Holding
                holding.currentQuantity += trade.quantity;
                holding.totalInvested += trade.netValue; // Fully loaded cost
                holding.averageBuyPrice = holding.totalInvested / holding.currentQuantity;

                // Add to fee trackers
                holding.totalBrokeragePaid += trade.brokerage;
                holding.totalTaxesPaid += (trade.stt + trade.otherTaxes + trade.dpCharges);

                await holding.save();

            } else if (trade.type === 'SELL') {
                let sharesToSell = trade.quantity;
                let totalFullyLoadedCostOfSoldShares = 0;
                let totalGrossCostOfSoldShares = 0; // Pure share price cost

                // 2. Fetch the FIFO Queue: Oldest BUYs that still have shares left
                const availableBuys = await Transaction.find({
                    isin: trade.isin,
                    type: 'BUY',
                    remainingQuantity: { $gt: 0 }
                }).sort({ tradeDate: 1 }); // Ascending order (oldest first)

                // 3. Consume the older shares
                for (const buy of availableBuys) {
                    if (sharesToSell === 0) break;

                    const sharesTaken = Math.min(sharesToSell, buy.remainingQuantity);

                    // Calculate the cost basis for ONLY the shares we are taking
                    const fullyLoadedCostBasis = (buy.netValue / buy.quantity) * sharesTaken;
                    const grossCostBasis = buy.price * sharesTaken;

                    totalFullyLoadedCostOfSoldShares += fullyLoadedCostBasis;
                    totalGrossCostOfSoldShares += grossCostBasis;

                    // Deduct from the BUY order and the SELL target
                    buy.remainingQuantity -= sharesTaken;
                    sharesToSell -= sharesTaken;
                    await buy.save();
                }

                if (sharesToSell > 0) {
                    console.warn(`WARNING: Sold more shares of ${trade.symbol} than found in database. Possible missing past contract notes.`);
                }

                // 4. Save the SELL transaction
                const newTx = new Transaction({
                    ...trade,
                    remainingQuantity: 0 // Sell orders don't go into the queue
                });
                await newTx.save();

                // 5. Calculate Exact Profit & Loss
                // Net Profit = (Net Cash Received) - (Net Cash Paid for those specific shares)
                const realizedNetPnL = trade.netValue - totalFullyLoadedCostOfSoldShares;

                // Gross Profit = (Gross Cash Received) - (Gross Cash Paid for those specific shares)
                const realizedGrossPnL = trade.grossValue - totalGrossCostOfSoldShares;

                // 6. Update the master Holding scoreboard
                holding.currentQuantity -= trade.quantity;
                holding.totalInvested -= totalFullyLoadedCostOfSoldShares; // Remove the cost of sold shares from the pool

                // Prevent average buy price from NaN if quantity hits 0
                holding.averageBuyPrice = holding.currentQuantity > 0 ? (holding.totalInvested / holding.currentQuantity) : 0;

                holding.realizedNetPnL = Number((holding.realizedNetPnL + realizedNetPnL).toFixed(2));
                holding.realizedGrossPnL = Number((holding.realizedGrossPnL + realizedGrossPnL).toFixed(2));

                holding.totalBrokeragePaid += trade.brokerage;
                holding.totalTaxesPaid += (trade.stt + trade.otherTaxes + trade.dpCharges);

                await holding.save();
            }
        }

        res.status(200).json({
            message: 'SUCCESS: Contract Note Processed & Database Updated',
            tradeDate,
            summary: {
                netAmountReceivablePayable,
                totalDpCharges,
                finalNetCashFlow
            },
            tradesProcessed: processedTrades.length
        });

    } catch (error) {
        if (error.name === 'PasswordException') return res.status(401).json({ error: 'Incorrect PDF password.' });
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { processContractNote };