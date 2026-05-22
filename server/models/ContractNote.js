const mongoose = require('mongoose');

const contractNoteSchema = new mongoose.Schema({
    tradeDate: { type: Date, required: true, unique: true }, // Ensures we don't upload the same day twice
    dailyTurnover: { type: Number, default: 0 },
    payInPayOut: { type: Number, default: 0 },
    totalBrokerage: { type: Number, default: 0 },
    totalSTT: { type: Number, default: 0 },
    totalOtherTaxes: { type: Number, default: 0 },
    netAmount: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ContractNote', contractNoteSchema);