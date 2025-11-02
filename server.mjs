import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import apiRoutes from './routes/index.mjs';
import { errorHandler } from './middleware/errorHandler.mjs';
import { initDb } from './db/database.mjs';
// import paystackRoutes from "./routes/paystackRoutes.mjs";
// --- Initialize Database ---
// This ensures the database and tables are created on startup if they don't exist.
initDb();

const app = express();
const PORT = process.env.PORT || 5001;

// --- Security & Core Middleware ---

// Set security-related HTTP headers
app.use(helmet());

// Enable CORS for the frontend application
// SECURITY: In production, restrict this to your actual frontend domain.
app.use(cors({ origin: 'http://localhost:5173' }));

// Parse JSON bodies
app.use(express.json());

// HTTP request logger
app.use(morgan('dev'));

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);
// app.use("/api/payments", paystackRoutes);
// --- API Routes ---
app.use('/api', apiRoutes);

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'Dr. Gemini Backend is running.',
        version: '1.0.0' 
    });
});

// --- Error Handling Middleware ---
// This should be the last middleware in the stack
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on https://localhost:${PORT}`);
});
