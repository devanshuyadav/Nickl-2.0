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

        // 3. Parse Aggregate Taxes from the bottom of the PDF
        const getTax = (regex) => {
            const match = fullText.match(regex);
            return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
        };

        const totalSTT = getTax(/Securities Transaction Tax.*?([\d.]+)/i);
        const exchangeCharges = getTax(/Exchange Transaction Charges.*?([\d.]+)/i);
        const sebiFees = getTax(/SEBI Turnover Fees.*?([\d.]+)/i);
        const stampDuty = getTax(/Stamp Duty.*?([\d.]+)/i);
        const cgst = getTax(/CGST.*?([\d.]+)/i);
        const sgst = getTax(/SGST.*?([\d.]+)/i);
        const igst = getTax(/IGST.*?([\d.]+)/i);

        const totalOtherTaxes = exchangeCharges + sebiFees + stampDuty + cgst + sgst + igst;

        // 4. Parse Individual Trades
        const extractedTrades = [];
        let dailyTurnover = 0; // We need this to apportion taxes fairly

        // UPDATED REGEX: Added `-?` to all number fields so it catches negative quantities and amounts without breaking the layout
        const tradeRegex = /(IN[A-Z0-9]{10})\s+([A-Za-z0-9\s\.\-\&]+?)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)/g;

        let match;
        while ((match = tradeRegex.exec(fullText)) !== null) {
            const isin = match[1];
            const symbol = match[2].trim();

            // We use Math.abs() because a sell of "-7" means 7 shares were sold. We want positive integers in the DB.
            const buyQty = Math.abs(parseInt(match[3], 10));
            if (buyQty > 0) {
                const value = Math.abs(parseFloat(match[7]));
                dailyTurnover += value;
                extractedTrades.push({
                    isin, symbol, type: 'BUY', quantity: buyQty,
                    price: Math.abs(parseFloat(match[4])),
                    brokerage: Math.abs(parseFloat(match[5])) * buyQty,
                    totalValue: value
                });
            }

            const sellQty = Math.abs(parseInt(match[8], 10));
            if (sellQty > 0) {
                const value = Math.abs(parseFloat(match[12]));
                dailyTurnover += value;
                extractedTrades.push({
                    isin, symbol, type: 'SELL', quantity: sellQty,
                    price: Math.abs(parseFloat(match[9])),
                    brokerage: Math.abs(parseFloat(match[10])) * sellQty,
                    totalValue: value
                });
            }
        }

        // 5. Apportion Taxes & Format Final Output
        const processedTrades = extractedTrades.map(trade => {
            // Find this trade's percentage of the day's total volume
            const proportion = dailyTurnover > 0 ? (trade.totalValue / dailyTurnover) : 0;

            const apportionedSTT = Number((totalSTT * proportion).toFixed(2));
            const apportionedOtherTaxes = Number((totalOtherTaxes * proportion).toFixed(2));

            // Calculate Final Net Value
            // Buy = Debited (Cost + Taxes) | Sell = Credited (Revenue - Taxes)
            let netValue = 0;
            if (trade.type === 'BUY') {
                netValue = trade.totalValue + trade.brokerage + apportionedSTT + apportionedOtherTaxes;
            } else {
                netValue = trade.totalValue - trade.brokerage - apportionedSTT - apportionedOtherTaxes;
            }

            return {
                ...trade,
                tradeDate,
                stt: apportionedSTT,
                otherTaxes: apportionedOtherTaxes,
                netValue: Number(netValue.toFixed(2))
            };
        });

        // We are just returning JSON for now to verify the math!
        res.status(200).json({
            message: 'Phase 1: PDF Extracted and Taxes Calculated',
            tradeDate,
            summaryTaxes: { totalSTT, totalOtherTaxes, dailyTurnover },
            tradesProcessed: processedTrades
        });

    } catch (error) {
        if (error.name === 'PasswordException') return res.status(401).json({ error: 'Incorrect PDF password.' });
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { processContractNote };