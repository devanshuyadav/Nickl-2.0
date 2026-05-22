const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { extractContractNote } = require('../controllers/pdf.controller');
const { executeTrades } = require('../controllers/trade.controller');

// 1. PDF goes in, JSON array of trades comes out (No DB mutation)
router.post('/extract-pdf', upload.single('contractNote'), extractContractNote);

// 2. Finalized JSON array goes in, DB updates happen (FIFO magic)
router.post('/execute-trades', executeTrades);

module.exports = router;