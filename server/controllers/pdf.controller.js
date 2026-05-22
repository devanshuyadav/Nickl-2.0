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

        // 3. Bulletproof Tax Extraction (Chunking Method with Sanitization)

        // We strip out Groww's GST explanatory parentheses so they don't trigger false positives 
        // when we search for keywords like "SEBI Turnover Fees" or "Exchange transaction charges".
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

        // 4. Parse Individual Trades, Find Daily Turnover & Cash Flow
        const extractedTrades = [];
        let dailyTurnover = 0;
        let totalBrokerage = 0;
        let payInPayOut = 0; // Pure cash flow tracker

        // UPDATED REGEX: Added \(\)\', to safely capture parentheses, apostrophes, and commas in company names
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
                payInPayOut -= grossValue; // Cash leaves your account (-)

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

            let netValue = 0;
            if (trade.type === 'BUY') {
                netValue = trade.grossValue + trade.brokerage + apportionedSTT + apportionedOtherTaxes;
            } else {
                netValue = trade.grossValue - trade.brokerage - apportionedSTT - apportionedOtherTaxes;
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
                netValue: Number(netValue.toFixed(2))
            };
        });

        const netAmount = Number((payInPayOut - totalBrokerage - totalSTT - totalOtherTaxes).toFixed(2));

        res.status(200).json({
            message: 'Plan B: Taxes Apportioned & Net Values Calculated',
            tradeDate,
            summary: {
                dailyTurnover: Number(dailyTurnover.toFixed(2)),
                payInPayOut: Number(payInPayOut.toFixed(2)),
                totalBrokerage: Number(totalBrokerage.toFixed(2)),
                totalSTT,
                totalOtherTaxes,
                netAmount
            },
            transactions: processedTrades
        });

    } catch (error) {
        if (error.name === 'PasswordException') return res.status(401).json({ error: 'Incorrect PDF password.' });
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { processContractNote };