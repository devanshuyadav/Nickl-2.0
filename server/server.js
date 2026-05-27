const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Allow requests from our future Next.js frontend
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Nickl Server v2 is alive and well.' });
});

//PDF upload routes
const uploadRoutes = require('./routes/upload.routes');
app.use('/api/upload', uploadRoutes);

// Dashboard / Portfolio routes
const dashboardRoutes = require('./routes/dashboard.routes');
app.use('/api/portfolio', dashboardRoutes);

// LIVE market data routes
const marketRoutes = require('./routes/market.routes');
app.use('/api/market', marketRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});