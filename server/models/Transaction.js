const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    isin: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    tradeDate: { type: Date, required: true },

    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }, // Pure share price

    // The exact fees apportioned to this specific trade
    brokerage: { type: Number, default: 0 },
    stt: { type: Number, default: 0 },
    otherTaxes: { type: Number, default: 0 },

    grossValue: { type: Number },
    // The Fully Loaded Value:
    // BUY = (Qty * Price) + Brokerage + STT + Other Taxes
    // SELL = (Qty * Price) - Brokerage - STT - Other Taxes
    netValue: { type: Number, required: true },

    // The FIFO Engine's Memory (Drops as you sell)
    remainingQuantity: { type: Number, required: true, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);