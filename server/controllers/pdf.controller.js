const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const extractContractNote = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });

        // Pull the password from the frontend request!
        const panPassword = req.body.password || process.env.PDF_PASSWORD;

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
            const nums = chunk.match(/[-]?\d+(?:\.\d+)?(?!\s*%)/g);
            return (nums && nums.length > 0) ? Math.abs(parseFloat(nums[0].replace(/,/g, ''))) : 0;
        };

        const totalSTT = getTax('Securities Transaction Tax');
        const totalOtherTaxes = Number((getTax('Exchange Transaction Charges') + getTax('SEBI Turnover Fees') + getTax('Stamp Duty') + getTax('CGST') + getTax('SGST') + getTax('IGST') + getTax('IPFT Charges') + getTax('UTT')).toFixed(2));

        // Extract DP Charges
        let totalDpCharges = 0;
        let dpIndex = sanitizedText.toLowerCase().indexOf('cdsl dp charges');
        if (dpIndex === -1) dpIndex = sanitizedText.toLowerCase().indexOf('groww dp charges');
        if (dpIndex !== -1) {
            const match = sanitizedText.substring(dpIndex, dpIndex + 400).match(/Total\s+([\d,]+\.\d+)/i);
            if (match) totalDpCharges = Math.abs(parseFloat(match[1].replace(/,/g, '')));
        }

        // 4. Header Fingerprinting & Trade Extraction
        let extractedTrades = [];
        let dailyTurnover = 0, sellTurnover = 0, totalBrokerage = 0, payInPayOut = 0;

        // --- FINGERPRINTING THE PDF ---
        // Scan the entire document for specific table headers that guarantee the format version.
        const isModernFormat = /WAP per Share|Total Value after brokerage/i.test(fullText);
        const isLegacyFormat = /Gross Rate\/ Trade Price|Closing Rate per Unit/i.test(fullText);

        if (isModernFormat) {
            console.log("🟢 Modern Format Detected: Using 14-Column Layout Parser...");

            // Matches: ISIN | Symbol | 5 Buy Cols | 5 Sell Cols | 2 Net Cols
            // We use (.+?) for the symbol so it doesn't break on weird characters like '*' or '@'
            const modernTradeRegex = /(IN[A-Z0-9]{10})\s+(.+?)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)/g;
            let match;

            while ((match = modernTradeRegex.exec(fullText)) !== null) {
                const isin = match[1];
                const symbol = match[2].trim();
                const buyQty = Math.abs(parseInt(match[3], 10));
                const sellQty = Math.abs(parseInt(match[8], 10));

                if (buyQty > 0) {
                    const tradeBrokerage = Math.abs(parseFloat(match[5])) * buyQty;
                    const grossValue = Math.abs(parseFloat(match[7])) - tradeBrokerage; // Derived from Total Value
                    dailyTurnover += grossValue;
                    totalBrokerage += tradeBrokerage;
                    payInPayOut -= grossValue;

                    extractedTrades.push({
                        isin, symbol, type: 'BUY', quantity: buyQty,
                        price: Math.abs(parseFloat(match[4])),
                        brokerage: Number(tradeBrokerage.toFixed(4)),
                        grossValue
                    });
                }

                if (sellQty > 0) {
                    const tradeBrokerage = Math.abs(parseFloat(match[10])) * sellQty;
                    const grossValue = Math.abs(parseFloat(match[12])) + tradeBrokerage;
                    dailyTurnover += grossValue;
                    sellTurnover += grossValue;
                    totalBrokerage += tradeBrokerage;
                    payInPayOut += grossValue;

                    extractedTrades.push({
                        isin, symbol, type: 'SELL', quantity: sellQty,
                        price: Math.abs(parseFloat(match[9])),
                        brokerage: Number(tradeBrokerage.toFixed(4)),
                        grossValue
                    });
                }
            }
        } else if (isLegacyFormat) {
            console.log("🟡 Legacy Format Detected: Using Continuous Stream Parser...");

            let unassignedTrades = [];

            // THE FIX: A single, global scanner that walks through the entire text stream.
            // It looks for EITHER a Trade row (Groups 1-5) OR a Total/ISIN row (Group 6).
            // Group 1: Raw Symbol (might contain trade numbers)
            // Group 2: Exchange
            // Group 3: B/S
            // Group 4: Quantity
            // Group 5: Price
            // Group 6: ISIN (Only exists if it matched a Total row)
            const legacyScannerRegex = /(?:\d{2}:\d{2}:\d{2}\s+([A-Za-z0-9\s\.\-\&\(\)\',]+?)\s+(NSE|BSE)\s+(B|S)\s+(-?[\d.,]+)\s+([\d.,]+))|(?:Total\s+(IN[A-Z0-9]{10}))/gi;

            let match;
            // .exec() with a /g regex loops sequentially through every single match in the document
            while ((match = legacyScannerRegex.exec(fullText)) !== null) {

                if (match[6]) {
                    // --- SCENARIO A: Found a "Total" row containing the ISIN ---
                    const foundIsin = match[6].toUpperCase();

                    // Assign this ISIN to ALL queued trades from the rows above
                    unassignedTrades.forEach(trade => {
                        trade.isin = foundIsin;

                        dailyTurnover += trade.grossValue;
                        if (trade.type === 'SELL') {
                            sellTurnover += trade.grossValue;
                            payInPayOut += trade.grossValue;
                        } else {
                            payInPayOut -= trade.grossValue;
                        }

                        extractedTrades.push(trade);
                    });

                    // Clear the queue for the next block of stocks
                    unassignedTrades = [];

                } else {
                    // --- SCENARIO B: Found a Trade Row ---
                    let rawSymbol = match[1];

                    // Split by any remaining internal timestamps (HH:MM:SS) to guarantee a clean string
                    const timeSplit = rawSymbol.split(/\d{2}:\d{2}:\d{2}/);
                    let symbol = timeSplit[timeSplit.length - 1].trim();

                    // Strip any stray order numbers from the prefix
                    symbol = symbol.replace(/^[\d\s]+/, '').trim();

                    // If the broker left the symbol blank on a grouped row, inherit it from the row above
                    if (!symbol && unassignedTrades.length > 0) {
                        symbol = unassignedTrades[unassignedTrades.length - 1].symbol;
                    }

                    const type = match[3].toUpperCase() === 'B' ? 'BUY' : 'SELL';
                    const quantity = Math.abs(parseFloat(match[4].replace(/,/g, '')));
                    const price = parseFloat(match[5].replace(/,/g, ''));
                    const grossValue = quantity * price;

                    if (symbol) {
                        unassignedTrades.push({ symbol, type, quantity, price, grossValue, brokerage: 0, isin: null });
                    }
                }
            }
        } else {
            // THE FAILSAFE
            throw new Error("🚨 Unrecognized PDF Format. Neither Modern nor Legacy column headers were found.");
        }

        if (extractedTrades.length === 0) {
            throw new Error("🚨 Format was recognized, but no valid trades could be extracted. Check the PDF text structure.");
        }

        // ==========================================
        // 4.5 CONSOLIDATE INTRA-DAY TRADES
        // Group multiple executions of the same stock into a single weighted-average row
        // ==========================================
        const consolidatedMap = {};

        extractedTrades.forEach(trade => {
            // Group by Symbol and Trade Type (BUY/SELL)
            const key = `${trade.symbol}_${trade.type}`;

            if (!consolidatedMap[key]) {
                consolidatedMap[key] = { ...trade }; // Create a new entry
            } else {
                // Add to existing entry
                consolidatedMap[key].quantity += trade.quantity;
                consolidatedMap[key].grossValue += trade.grossValue;
                consolidatedMap[key].brokerage += trade.brokerage;

                // Calculate true Weighted Average Price = (Total Value / Total Quantity)
                consolidatedMap[key].price = Number((consolidatedMap[key].grossValue / consolidatedMap[key].quantity).toFixed(4));
            }
        });

        // Replace the raw extracted trades with our newly grouped, clean list
        extractedTrades = Object.values(consolidatedMap);

        // 5. Apportion Taxes
        const processedTrades = extractedTrades.map(trade => {
            const proportion = dailyTurnover > 0 ? (trade.grossValue / dailyTurnover) : 0;
            const apportionedSTT = Number((totalSTT * proportion).toFixed(2));
            const apportionedOtherTaxes = Number((totalOtherTaxes * proportion).toFixed(2));
            let apportionedDp = 0, netValue = 0;

            if (trade.type === 'BUY') {
                // netValue = trade.grossValue + trade.brokerage + apportionedSTT + apportionedOtherTaxes;
                netValue = trade.grossValue;
            } else {
                apportionedDp = Number((totalDpCharges * (sellTurnover > 0 ? trade.grossValue / sellTurnover : 0)).toFixed(2));
                netValue = trade.grossValue - trade.brokerage - apportionedSTT - apportionedOtherTaxes - apportionedDp;
            }

            return {
                isin: trade.isin, symbol: trade.symbol, tradeDate, type: trade.type,
                quantity: trade.quantity, price: trade.price, brokerage: trade.brokerage,
                stt: apportionedSTT, otherTaxes: apportionedOtherTaxes, dpCharges: apportionedDp,
                grossValue: trade.grossValue, netValue: Number(netValue.toFixed(2))
            };
        });

        const netAmountReceivablePayable = Number((payInPayOut - totalBrokerage - totalSTT - totalOtherTaxes).toFixed(2));
        const finalNetCashFlow = Number((netAmountReceivablePayable - totalDpCharges).toFixed(2));

        // Return Data for the Frontend Confirmation Screen
        res.status(200).json({
            tradeDate,
            summary: { dailyTurnover, payInPayOut, totalBrokerage, totalSTT, totalOtherTaxes, netAmountReceivablePayable, totalDpCharges, finalNetCashFlow },
            transactions: processedTrades
        });

    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { extractContractNote };