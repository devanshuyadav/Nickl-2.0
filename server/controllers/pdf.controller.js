const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const extractContractNote = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });

        const panPassword = req.body.password || process.env.PDF_PASSWORD;
        if (!panPassword) return res.status(500).json({ error: 'PDF_PASSWORD is not set.' });

        // 1. Crack the PDF
        const dataBuffer = new Uint8Array(req.file.buffer);
        const loadingTask = pdfjsLib.getDocument({ data: dataBuffer, password: panPassword, useSystemFonts: true });

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

        const getTax = (keywords) => {
            const keywordList = Array.isArray(keywords) ? keywords : [keywords];
            for (let kw of keywordList) {
                const index = sanitizedText.toLowerCase().indexOf(kw.toLowerCase());
                if (index !== -1) {
                    const chunk = sanitizedText.substring(index + kw.length, index + kw.length + 150);
                    const nums = chunk.match(/[-]?\d+(?:\.\d+)?(?!\s*%)/g);
                    if (nums && nums.length > 0) {
                        if (kw === 'DP Charges' || kw === 'CDSL DP Charges' || kw === 'Groww DP Charges') {
                            return Math.abs(parseFloat(nums[2].replace(/,/g, '')));
                        } else {
                            return Math.abs(parseFloat(nums[0].replace(/,/g, '')));
                        }
                    }
                }
            }
            return -2;
        };

        const helper = (k) => {
            return getTax([k]) != -2 ? getTax([k]) : 0
        }

        const TotalBrokerage = getTax(['Taxable Value of Supply (Brokerage)']) != -2 ? getTax(['Taxable Value of Supply (Brokerage)']) : 0; console.log("Brokerage", TotalBrokerage);
        const ExchangeTransactionCharges = getTax(['Exchange Transaction Charges']) != -2 ? getTax(['Exchange Transaction Charges']) : 0; console.log("ETC", ExchangeTransactionCharges);
        const CGST = helper('CGST'); console.log("FINAL: CGST", CGST);
        const SGST = helper('SGST'); console.log("FINAL: SGST", SGST);
        const IGST = helper('IGST'); console.log("FINAL: IGST", IGST);
        const UTT = helper('UTT'); console.log("FINAL: UTT", UTT);
        const STT = helper('Securities Transaction Tax'); console.log("FINAL: STT", STT);
        const SEBITurnoverFees = helper('SEBI Turnover Fees'); console.log("FINAL: SEBITurnoverFees", SEBITurnoverFees);
        const StampDuty = helper('Stamp Duty'); console.log("FINAL: StampDuty", StampDuty);
        const IPFTCharges = helper('IPFT Charges'); console.log("FINAL: IPFTCharges", IPFTCharges);

        const totalOtherTaxes = Number((getTax(['SEBI Turnover Fees']) + getTax(['Stamp Duty']) + getTax(['CGST']) + getTax(['SGST']) + getTax(['IGST']) + getTax(['IPFT Charges']) + getTax(['UTT'])).toFixed(2));

        console.log("CDSL DP", getTax(['CDSL DP Charges']))
        console.log("Groww DP", getTax(['Groww DP Charges']))
        console.log("DP", getTax(['DP Charges']))

        // DP Charges calculation
        let TotalDpCharges = 0;
        if (getTax(['CDSL DP Charges']) != -2 && getTax(['Groww DP Charges']) != -2) { // means it is modern format
            console.log("modern dp charge");
            TotalDpCharges = getTax(['CDSL DP Charges']) + getTax(['Groww DP Charges']); // means it is legacy format
        } else if (getTax(['DP Charges']) != -2) { // else if to prevent cases where DP charge is NA
            // DP charges is in else if clause because it will be detected in above cases as well
            console.log("legacy dp charge");
            TotalDpCharges = getTax(['DP Charges']);
        }
        console.log("totalDpCharges", TotalDpCharges);

        // 4. Header Fingerprinting & Trade Extraction
        let extractedTrades = [];
        let DailyTurnover = 0, PayInPayOut = 0;

        // --- FINGERPRINTING THE PDF ---
        // Scan the entire document for specific table headers that guarantee the format version.
        const isModernFormat = /WAP per Share|Total Value after brokerage/i.test(fullText);
        const isLegacyFormat = /Gross Rate\/ Trade Price|Closing Rate per Unit/i.test(fullText);

        if (isModernFormat) {
            console.log("Modern Format Detected: Using 14-Column Layout Parser...");

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
                    DailyTurnover -= grossValue;
                    PayInPayOut -= grossValue;

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
                    DailyTurnover += grossValue;
                    PayInPayOut += grossValue;

                    extractedTrades.push({
                        isin, symbol, type: 'SELL', quantity: sellQty,
                        price: Math.abs(parseFloat(match[9])),
                        brokerage: Number(tradeBrokerage.toFixed(4)),
                        grossValue
                    });
                }
            }
        } else if (isLegacyFormat) {
            console.log("Legacy Format Detected: Using Continuous Stream Parser...");

            let unassignedTrades = [];

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

                        if (trade.type === 'SELL') {
                            DailyTurnover += trade.grossValue;
                            PayInPayOut += trade.grossValue;
                        } else {
                            DailyTurnover -= trade.grossValue;
                            PayInPayOut -= trade.grossValue;
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
            throw new Error("Unrecognized PDF Format. Neither Modern nor Legacy column headers were found.");
        }

        if (extractedTrades.length === 0) {
            throw new Error("Format was recognized, but no valid trades could be extracted. Check the PDF text structure.");
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
        console.log(extractedTrades);

        // 5. REMOVE APPORTIONMENT – per-trade fees are now zero. All fees are handled globally via the summary.
        const processedTrades = extractedTrades.map(trade => ({
            isin: trade.isin,
            symbol: trade.symbol,
            tradeDate,                      // from outer scope
            type: trade.type,
            quantity: trade.quantity,
            price: trade.price,             // weighted average if consolidation ran
            brokerage: 0,
            stt: 0,
            otherTaxes: 0,
            dpCharges: 0,
            grossValue: trade.grossValue,
            netValue: Number(trade.grossValue.toFixed(2))
        }));

        const NetAmountReceivablePayable = Number((PayInPayOut - TotalBrokerage - ExchangeTransactionCharges - CGST - SGST - IGST - UTT - STT - SEBITurnoverFees - StampDuty - IPFTCharges).toFixed(2));
        console.log("netAmountReceivablePayable", NetAmountReceivablePayable);
        const FinalNetCashFlow = Number((NetAmountReceivablePayable - TotalDpCharges).toFixed(2));
        console.log("finalNetCashFlow", FinalNetCashFlow);

        // Return Data for the Frontend Confirmation Screen
        const response = {
            tradeDate,
            summary: {
                dailyTurnover: DailyTurnover,
                payInPayOut: PayInPayOut,
                totalBrokerage: TotalBrokerage,
                exchangeTransactionCharges: ExchangeTransactionCharges,
                cgst: CGST,
                sgst: SGST,
                igst: IGST,
                utt: UTT,
                stt: STT,
                sebiFees: SEBITurnoverFees,
                stampDuty: StampDuty,
                ipft: IPFTCharges,
                netAmountReceivablePayable: NetAmountReceivablePayable,
                dp: TotalDpCharges,
                finalNetCashFlow: FinalNetCashFlow
            },
            transactions: processedTrades
        }
        console.log("response", response);

        res.status(200).json({
            tradeDate,
            summary: {
                dailyTurnover: DailyTurnover,
                payInPayOut: PayInPayOut,
                totalBrokerage: TotalBrokerage,
                exchangeTransactionCharges: ExchangeTransactionCharges,
                cgst: CGST,
                sgst: SGST,
                igst: IGST,
                utt: UTT,
                stt: STT,
                sebiFees: SEBITurnoverFees,
                stampDuty: StampDuty,
                ipft: IPFTCharges,
                netAmountReceivablePayable: NetAmountReceivablePayable,
                dp: TotalDpCharges,
                finalNetCashFlow: FinalNetCashFlow
            },
            transactions: processedTrades
        });

    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { extractContractNote };