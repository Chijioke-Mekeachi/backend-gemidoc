import { Router } from 'express';
import { getHistory, clearHistory } from '../controllers/historyController.mjs';
import { protect } from '../middleware/auth.mjs';

const router = Router();

// @route   GET /api/history
// @desc    Get user's chat and transaction history
// @access  Private
router.get('/', protect, getHistory);

// @route   DELETE /api/history
// @desc    Clear user's chat history
// @access  Private
router.delete('/', protect, clearHistory);

export default router;
