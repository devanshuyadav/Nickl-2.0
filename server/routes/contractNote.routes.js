const express = require('express');
const router = express.Router();
const ContractNote = require('../models/ContractNote');

// GET /api/contract-notes – Fetch all contract notes (latest first)
router.get('/', async (req, res) => {
    try {
        const notes = await ContractNote.find().sort({ tradeDate: -1 });
        res.json(notes);
    } catch (error) {
        console.error('Error fetching contract notes:', error);
        res.status(500).json({ error: 'Failed to fetch contract notes' });
    }
});

module.exports = router;