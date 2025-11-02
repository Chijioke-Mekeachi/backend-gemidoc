import { Router } from 'express';
import authRoutes from './auth.mjs';
import chatRoutes from './chat.mjs';
import creditsRoutes from './credits.mjs';
import historyRoutes from './history.mjs';

const router = Router();

router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/credits', creditsRoutes);
router.use('/history', historyRoutes);

export default router;
