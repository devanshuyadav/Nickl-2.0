const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const processContractNote = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        const panPassword = process.env.PDF_PASSWORD;
        if (!panPassword) {
            return res.status(500).json({ error: 'PDF_PASSWORD is not set in your .env file.' });
        }

        // Convert Multer's Node Buffer into a Uint8Array for Mozilla's engine
        const dataBuffer = new Uint8Array(req.file.buffer);

        // Step 1: Bypassing wrappers and cracking AES-256 directly
        const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            password: panPassword,
            useSystemFonts: true
        });

        const pdfDocument = await loadingTask.promise;
        let fullText = "";

        // Step 2: Extract text from all pages
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + "\n";
        }

        // Step 3: Parsing the Groww 14-Column Table
        const extractedTrades = [];

        /* REGEX BREAKDOWN:
          1: ISIN (e.g., INE242A01010)
          2: Name (e.g., INDIAN OIL CORP LTD)
          3-7: Buy Qty, Buy WAP, Buy Brk, Buy WAP+Brk, Buy Total
          8-12: Sell Qty, Sell WAP, Sell Brk, Sell WAP+Brk, Sell Total
          13-14: Net Qty, Net Amount
        */
        const tradeRegex = /(IN[A-Z0-9]{10})\s+([A-Za-z0-9\s\.\-\&]+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+([-\d]+)\s+([-\d.]+)/g;

        let match;
        while ((match = tradeRegex.exec(fullText)) !== null) {
            const isin = match[1];
            const symbol = match[2].trim();

            const buyQty = parseInt(match[3], 10);
            const buyPrice = parseFloat(match[4]);
            const buyBrokerage = parseFloat(match[5]);

            const sellQty = parseInt(match[8], 10);
            const sellPrice = parseFloat(match[9]);
            const sellBrokerage = parseFloat(match[10]);

            // If Buy Quantity is greater than 0, push a BUY object
            if (buyQty > 0) {
                extractedTrades.push({
                    isin: isin,
                    symbol: symbol,
                    type: 'BUY',
                    quantity: buyQty,
                    price: buyPrice,
                    brokerage: buyBrokerage,
                    totalValue: parseFloat(match[7])
                });
            }

            // If Sell Quantity is greater than 0, push a SELL object
            // Note: If you do intraday, BOTH if-statements trigger, perfectly capturing both sides of the trade.
            if (sellQty > 0) {
                extractedTrades.push({
                    isin: isin,
                    symbol: symbol,
                    type: 'SELL',
                    quantity: sellQty,
                    price: sellPrice,
                    brokerage: sellBrokerage,
                    totalValue: parseFloat(match[12])
                });
            }
        }

        res.status(200).json({
            message: 'Contract Note processed successfully',
            tradeCount: extractedTrades.length,
            trades: extractedTrades
        });

    } catch (error) {
        // pdfjs throws a specific error name when the password fails
        if (error.name === 'PasswordException') {
            return res.status(401).json({ error: 'Incorrect PDF password in .env file.' });
        }

        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Internal server error during processing.' });
    }
};

module.exports = {
    processContractNote
};