const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows your Next.js frontend to communicate with this API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const uploadRoutes = require('./routes/upload.routes');
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server is running normally.' });
});

app.listen(PORT, () => {
    console.log(`Nickl server is listening on port ${PORT}`);
});