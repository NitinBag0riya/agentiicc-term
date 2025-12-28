/**
 * API Routes
 * 
 * Main router that aggregates all route modules.
 */

import { Router, Request, Response } from 'express';
import authRoutes from './routes/auth.routes';
import orderRoutes from './routes/orders.routes';
import accountRoutes from './routes/account.routes';
import positionRoutes from './routes/positions.routes';
import marketRoutes from './routes/market.routes';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// User and auth routes (mounted at root - auth.routes has full paths)
router.use('/', authRoutes);

// Order routes - /order and /orders both use same handler
router.use('/order', orderRoutes);
router.use('/orders', orderRoutes);

// Account routes - /account/*
router.use('/account', accountRoutes);

// Position routes - /positions and /position
router.use('/positions', positionRoutes);
router.use('/position', positionRoutes);

// Market data routes (mounted at root)
router.use('/', marketRoutes);

export default router;
