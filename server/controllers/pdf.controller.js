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

        // 4. Parse Individual Trades
        const extractedTrades = [];
        let dailyTurnover = 0, sellTurnover = 0, totalBrokerage = 0, payInPayOut = 0;

        const tradeRegex = /(IN[A-Z0-9]{10})\s+([A-Za-z0-9\s\.\-\&\(\)\',]+?)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?\d+)\s+(-?[\d.]+)/g;

        let match;
        while ((match = tradeRegex.exec(fullText)) !== null) {
            const isin = match[1], symbol = match[2].trim();
            const buyQty = Math.abs(parseInt(match[3], 10));
            const sellQty = Math.abs(parseInt(match[8], 10));

            if (buyQty > 0) {
                const tradeBrokerage = Math.abs(parseFloat(match[5])) * buyQty;
                const grossValue = Math.abs(parseFloat(match[7])) - tradeBrokerage;
                dailyTurnover += grossValue;
                totalBrokerage += tradeBrokerage;
                payInPayOut -= grossValue;
                extractedTrades.push({ isin, symbol, type: 'BUY', quantity: buyQty, price: Math.abs(parseFloat(match[4])), brokerage: Number(tradeBrokerage.toFixed(4)), grossValue });
            }
            if (sellQty > 0) {
                const tradeBrokerage = Math.abs(parseFloat(match[10])) * sellQty;
                const grossValue = Math.abs(parseFloat(match[12])) + tradeBrokerage;
                dailyTurnover += grossValue;
                sellTurnover += grossValue;
                totalBrokerage += tradeBrokerage;
                payInPayOut += grossValue;
                extractedTrades.push({ isin, symbol, type: 'SELL', quantity: sellQty, price: Math.abs(parseFloat(match[9])), brokerage: Number(tradeBrokerage.toFixed(4)), grossValue });
            }
        }

        // 5. Apportion Taxes
        const processedTrades = extractedTrades.map(trade => {
            const proportion = dailyTurnover > 0 ? (trade.grossValue / dailyTurnover) : 0;
            const apportionedSTT = Number((totalSTT * proportion).toFixed(2));
            const apportionedOtherTaxes = Number((totalOtherTaxes * proportion).toFixed(2));
            let apportionedDp = 0, netValue = 0;

            if (trade.type === 'BUY') {
                netValue = trade.grossValue + trade.brokerage + apportionedSTT + apportionedOtherTaxes;
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