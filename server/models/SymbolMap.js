const mongoose = require('mongoose');

const SymbolMapSchema = new mongoose.Schema({
    pdfSymbol: { type: String, required: true, unique: true }, // e.g., "INTERGLOBE AVIATION LTD"
    yahooSymbol: { type: String, required: true }              // e.g., "INDIGO.NS"
}, { timestamps: true });

module.exports = mongoose.model('SymbolMap', SymbolMapSchema);