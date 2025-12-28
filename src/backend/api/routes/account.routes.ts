/**
 * Account Routes
 * 
 * Account info, leverage, and margin endpoints.
 */

import { Router, Request, Response } from 'express';
import { AdapterFactory } from '../../adapters/factory';
import { withAuth } from '../../middleware/auth';

const router = Router();

/**
 * Get account info
 */
router.get('/', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const accountInfo = await adapter.getAccount();

  res.json({ success: true, data: accountInfo });
}));

/**
 * Set leverage
 */
router.post('/leverage', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId
  );

  if (!adapter.setLeverage) {
    return res.json({ success: false, error: 'Exchange does not support setting leverage' });
  }

  const result = await adapter.setLeverage(req.body.symbol, parseInt(req.body.leverage));
  res.json(result);
}));

/**
 * Set margin mode
 */
router.post('/margin-mode', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId
  );

  if (!adapter.setMarginMode) {
    return res.json({ success: false, error: 'Exchange does not support setting margin mode' });
  }

  const result = await adapter.setMarginMode(req.body.symbol, req.body.mode);
  res.json(result);
}));

export default router;
