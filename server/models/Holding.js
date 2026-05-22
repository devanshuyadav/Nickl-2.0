const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    isin: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },

    currentQuantity: { type: Number, default: 0 },
    totalInvested: { type: Number, default: 0 }, // Fully loaded cost
    averageBuyPrice: { type: Number, default: 0 },

    // The Plan B Scoreboard
    realizedGrossPnL: { type: Number, default: 0 },
    totalBrokeragePaid: { type: Number, default: 0 },
    totalTaxesPaid: { type: Number, default: 0 },
    realizedNetPnL: { type: Number, default: 0 } // The Holy Grail Metric
}, { timestamps: true });

module.exports = mongoose.model('Holding', holdingSchema);