const express = require('express');
const router = express.Router();
const ContractNote = require('../models/ContractNote');
const Transaction = require('../models/Transaction');
const { rebuildHoldings } = require('../services/portfolioRebuilder');

// GET /api/contract-notes
router.get('/', async (req, res) => {
    try {
        const notes = await ContractNote.find().sort({ tradeDate: -1 });
        res.json(notes);
    } catch (error) {
        console.error('Error fetching contract notes:', error);
        res.status(500).json({ error: 'Failed to fetch contract notes' });
    }
});

// DELETE /api/contract-notes/:tradeDate
router.delete('/:tradeDate', async (req, res) => {
    console.log('DELETE request received for tradeDate:', req.params.tradeDate);
    try {
        const { tradeDate } = req.params;
        // Parse the date (YYYY-MM-DD)
        const dateObj = new Date(tradeDate);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
        }

        // 1. Delete the ContractNote
        const deletedNote = await ContractNote.findOneAndDelete({ tradeDate: dateObj });
        if (!deletedNote) {
            return res.status(404).json({ error: 'Contract note not found.' });
        }

        // 2. Delete all transactions with that tradeDate
        await Transaction.deleteMany({ tradeDate: dateObj });

        // 3. Rebuild holdings from remaining transactions
        await rebuildHoldings();

        res.status(200).json({ message: 'Contract note and its transactions deleted successfully. Holdings rebuilt.' });
    } catch (error) {
        console.error('Error deleting contract note:', error);
        res.status(500).json({ error: 'Failed to delete contract note.' });
    }
});

module.exports = router;