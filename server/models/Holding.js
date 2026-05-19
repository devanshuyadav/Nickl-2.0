const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    // Identity
    isin: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },

    // Current Portfolio State
    currentQuantity: { type: Number, default: 0 },
    totalInvested: { type: Number, default: 0 }, // Includes the buy-side fees & taxes
    averageBuyPrice: { type: Number, default: 0 }, // totalInvested / currentQuantity

    // The Scoreboard (Realized P&L)
    realizedGrossPnL: { type: Number, default: 0 }, // Pure share price diff via FIFO
    totalBrokeragePaid: { type: Number, default: 0 }, // Cumulative brokerage on all trades
    totalTaxesPaid: { type: Number, default: 0 }, // Cumulative STT + Other Taxes on all trades

    // The Golden Metric (Gross P&L - Total Brokerage - Total Taxes)
    realizedNetPnL: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Holding', holdingSchema);