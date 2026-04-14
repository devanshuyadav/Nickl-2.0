const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');

const processContractNote = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        const panPassword = process.env.PDF_PASSWORD;
        if (!panPassword) {
            return res.status(500).json({ error: 'PDF_PASSWORD is not set in your .env file.' });
        }

        const dataBuffer = new Uint8Array(req.file.buffer);

        // Bypassing wrappers and cracking AES-256 directly
        const loadingTask = pdfjsLib.getDocument({
            data: dataBuffer,
            password: panPassword,
            useSystemFonts: true
        });

        const pdfDocument = await loadingTask.promise;
        let fullText = "";

        // Extract text from all pages
        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + "\n";
        }

        // Extract Trade Date from the text
        const dateMatch = fullText.match(/Trade Date\s+(\d{2}-\d{2}-\d{4})/i);
        const tradeDateStr = dateMatch ? dateMatch[1].split('-').reverse().join('-') : null;
        const tradeDate = tradeDateStr ? new Date(tradeDateStr) : new Date();

        // Parse trades using Regex
        const extractedTrades = [];
        const tradeRegex = /(IN[A-Z0-9]{10})\s+([A-Za-z0-9\s\.\-\&]+?)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+([-\d]+)\s+([-\d.]+)/g;

        let match;
        while ((match = tradeRegex.exec(fullText)) !== null) {
            const isin = match[1];
            const symbol = match[2].trim();

            const buyQty = parseInt(match[3], 10);
            if (buyQty > 0) {
                extractedTrades.push({
                    isin, symbol, type: 'BUY',
                    quantity: buyQty,
                    price: parseFloat(match[4]),
                    brokerage: parseFloat(match[5]),
                    // Using Math.abs() to keep DB values positive/clean
                    totalValue: Math.abs(parseFloat(match[7]))
                });
            }

            const sellQty = parseInt(match[8], 10);
            if (sellQty > 0) {
                extractedTrades.push({
                    isin, symbol, type: 'SELL',
                    quantity: sellQty,
                    price: parseFloat(match[9]),
                    brokerage: parseFloat(match[10]),
                    totalValue: Math.abs(parseFloat(match[12]))
                });
            }
        }

        // Process Database Updates and FIFO Calculation
        // We process sequentially to maintain accurate database state
        for (const trade of extractedTrades) {
            if (trade.type === 'BUY') {
                // 1. Save the transaction. remainingQuantity equals total bought initially.
                await Transaction.create({
                    ...trade,
                    tradeDate,
                    remainingQuantity: trade.quantity
                });

                // 2. Update or Create Holding
                const holding = await Holding.findOne({ isin: trade.isin });
                if (holding) {
                    holding.currentQuantity += trade.quantity;
                    holding.totalInvested += trade.totalValue;
                    holding.averageBuyPrice = holding.totalInvested / holding.currentQuantity;
                    await holding.save();
                } else {
                    await Holding.create({
                        isin: trade.isin,
                        symbol: trade.symbol,
                        currentQuantity: trade.quantity,
                        totalInvested: trade.totalValue,
                        averageBuyPrice: trade.totalValue / trade.quantity
                    });
                }

            } else if (trade.type === 'SELL') {
                let qtyToSell = trade.quantity;
                let totalCostOfSoldShares = 0;

                // 1. Fetch past BUYs for this specific stock that haven't been fully sold yet
                const availableBuys = await Transaction.find({
                    isin: trade.isin,
                    type: 'BUY',
                    remainingQuantity: { $gt: 0 }
                }).sort({ tradeDate: 1, createdAt: 1 }); // Oldest first for true FIFO

                // 2. Deduct shares from oldest buys until the sell order is fulfilled
                for (const buy of availableBuys) {
                    if (qtyToSell === 0) break;

                    const qtyFromThisBuy = Math.min(qtyToSell, buy.remainingQuantity);

                    // Calculate the exact cost of the shares we are selling right now
                    const costRatio = qtyFromThisBuy / buy.quantity;
                    totalCostOfSoldShares += (buy.totalValue * costRatio);

                    buy.remainingQuantity -= qtyFromThisBuy;
                    await buy.save();

                    qtyToSell -= qtyFromThisBuy;
                }

                // 3. Save the SELL transaction
                await Transaction.create({ ...trade, tradeDate, remainingQuantity: 0 });

                // 4. Calculate P&L and update Holdings
                const realizedPnL = trade.totalValue - totalCostOfSoldShares;

                const holding = await Holding.findOne({ isin: trade.isin });
                if (holding) {
                    holding.currentQuantity -= trade.quantity;
                    // We remove the original cost of these specific shares from totalInvested
                    holding.totalInvested -= totalCostOfSoldShares;
                    holding.realizedPnL += realizedPnL;

                    // Prevent NaN if all shares are sold
                    holding.averageBuyPrice = holding.currentQuantity > 0
                        ? (holding.totalInvested / holding.currentQuantity)
                        : 0;

                    await holding.save();
                }
            }
        }

        res.status(200).json({
            message: 'Contract Note processed, P&L calculated, and database updated successfully',
            tradeDate: tradeDate,
            tradeCount: extractedTrades.length,
            tradesProcessed: extractedTrades
        });

    } catch (error) {
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