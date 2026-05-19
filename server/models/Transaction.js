const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Core Trade Data
    isin: { type: String, required: true, index: true }, // Indexed for fast FIFO queries
    symbol: { type: String, required: true },
    tradeDate: { type: Date, required: true },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },

    // The FIFO Engine's Memory
    // For BUYs: starts equal to 'quantity', drops as you sell.
    // For SELLs: always 0.
    remainingQuantity: { type: Number, required: true, default: 0 },

    // Exact Costs for this specific trade
    brokerage: { type: Number, default: 0 },
    stt: { type: Number, default: 0 },
    otherTaxes: { type: Number, default: 0 }, // Exchange fees, SEBI, Stamp Duty, GST combined

    // The actual cash impact:
    // Buy = (Qty * Price) + Brokerage + STT + Other Taxes
    // Sell = (Qty * Price) - Brokerage - STT - Other Taxes
    netValue: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);