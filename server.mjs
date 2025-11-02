import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import apiRoutes from './routes/index.mjs';
import { errorHandler } from './middleware/errorHandler.mjs';
import { initDb } from './db/database.mjs';

// --- Initialize Database ---
initDb();

const app = express();
const PORT = process.env.PORT || 5001;

// ✅ Must come first — trust proxy headers for Render/Netlify
app.set('trust proxy', 1);

// --- Security & Core Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- Rate Limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);

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
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
