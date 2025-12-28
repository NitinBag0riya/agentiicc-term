/**
 * Position Routes
 * 
 * Position management, TP/SL, and margin endpoints.
 */

import { Router, Request, Response } from 'express';
import { AdapterFactory } from '../../adapters/factory';
import { withAuth } from '../../middleware/auth';

const router = Router();

/**
 * Get positions
 */
router.get('/', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const positions = await adapter.getPositions();
  
  res.json({ success: true, data: positions });
}));

/**
 * Set TP and SL
 */
router.post('/tp-sl', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  const result = await adapter.setPositionTPSL(req.body.symbol, req.body.tp, req.body.sl);
  res.json(result);
}));

/**
 * Set take profit only
 */
router.post('/take-profit', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  const result = await adapter.setPositionTPSL(req.body.symbol, req.body.price, undefined);
  res.json(result);
}));

/**
 * Set stop loss only
 */
router.post('/stop-loss', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  const result = await adapter.setPositionTPSL(req.body.symbol, undefined, req.body.price);
  res.json(result);
}));

/**
 * Update position margin
 */
router.post('/margin', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  const result = await adapter.updatePositionMargin(req.body.symbol, req.body.amount, req.body.type);
  res.json(result);
}));

export default router;
