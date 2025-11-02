// routes/credits.mjs
import express from 'express';
import {
    getBalance,
    verifyPayment,
    getTransactionHistory,
    getSubscriptionStatus
} from '../controllers/creditsController.mjs';
import { protect } from '../middleware/auth.mjs';

const router = express.Router();


// Apply authentication to all routes in this router
router.use(protect);

router.get('/balance', getBalance);
router.post('/verify-payment', verifyPayment);
router.get('/transactions', getTransactionHistory);
router.get('/subscription', getSubscriptionStatus);

export default router;