const mongoose = require('mongoose');

const contractNoteSchema = new mongoose.Schema({
    tradeDate: { type: Date, required: true, unique: true, index: true },
    dailyTurnover: { type: Number, default: 0 },
    totalBrokerage: { type: Number, default: 0 },
    totalSTT: { type: Number, default: 0 },
    totalDPCharge: { type: Number, default: 0 },
    totalOtherTaxes: { type: Number, default: 0 },
    netCashFlow: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ContractNote', contractNoteSchema);