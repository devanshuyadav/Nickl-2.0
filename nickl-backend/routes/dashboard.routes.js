const express = require('express');
const { getPortfolio, getStockTransactions } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/portfolio', getPortfolio);
router.get('/transactions/:isin', getStockTransactions);

module.exports = router;