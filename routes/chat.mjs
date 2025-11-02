import { Router } from 'express';
import { handleChat } from '../controllers/chatController.mjs';
import { protect } from '../middleware/auth.mjs';

const router = Router();

// @route   POST /api/chat
// @desc    Handle both general chat and diagnosis requests
// @access  Private
router.post('/', protect, handleChat);

export default router;
