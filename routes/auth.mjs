import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController.mjs';
import { protect } from '../middleware/auth.mjs';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', login);

// @route   GET /api/auth/profile
// @desc    Get user profile (requires authentication)
// @access  Private
router.get('/profile', protect, getProfile);

export default router;
