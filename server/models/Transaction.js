const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    isin: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    tradeDate: { type: Date, required: true },

    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }, // Pure share price

    grossValue: { type: Number, required: true }, // quantity * price
    netValue: { type: Number, required: true },   // equals grossValue now

    // The FIFO Engine's Memory (Drops as you sell)
    remainingQuantity: { type: Number, required: true, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);