const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    isin: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    currentQuantity: { type: Number, default: 0 },
    averageBuyPrice: { type: Number, default: 0 },
    totalInvested: { type: Number, default: 0 },
    realizedPnL: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Holding', holdingSchema);