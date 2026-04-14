const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    tradeDate: { type: Date, required: true },
    isin: { type: String, required: true },
    symbol: { type: String, required: true },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    remainingQuantity: { type: Number, default: 0 }, // ADD THIS LINE for FIFO tracking
    price: { type: Number, required: true },
    brokerage: { type: Number, default: 0 },
    totalValue: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);