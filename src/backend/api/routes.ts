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

// Mount route modules
router.use('/auth', authRoutes);
router.use('/order', orderRoutes);
router.use('/orders', orderRoutes);
router.use('/account', accountRoutes);
router.use('/positions', positionRoutes);
router.use('/position', positionRoutes);

// Market data routes (mounted at root level for backwards compatibility)
router.use('/', marketRoutes);

// User routes from auth module (mounted at root for backwards compatibility)
router.use('/', authRoutes);

export default router;
