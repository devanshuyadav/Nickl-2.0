const express = require('express');
const { getPortfolio } = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/portfolio', getPortfolio);

module.exports = router;