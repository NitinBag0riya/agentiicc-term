/**
 * Order Routes
 * 
 * Order placement, management, and history endpoints.
 */

import { Router, Request, Response } from 'express';
import { AdapterFactory } from '../../adapters/factory';
import { withAuth } from '../../middleware/auth';
import { createLogger } from '../../../services/logger';
import type { PlaceOrderParams } from '../../adapters/base.adapter';

const router = Router();
const log = createLogger('OrderRoutes');

/**
 * Place order
 */
router.post('/', withAuth(async (req: Request, res: Response) => {
  try {
    const exchangeId = req.body.exchange || req.session?.activeExchange;
    const adapter = await AdapterFactory.createAdapter(
      req.session!.userId,
      exchangeId
    );

    const params: PlaceOrderParams = {
      symbol: req.body.symbol,
      side: req.body.side,
      type: req.body.type,
      quantity: req.body.quantity,
      price: req.body.price,
      triggerPrice: req.body.triggerPrice || req.body.stopPrice,
      takeProfit: req.body.takeProfit,
      stopLoss: req.body.stopLoss,
      reduceOnly: req.body.reduceOnly,
      leverage: req.body.leverage,
      trailingDelta: req.body.trailingDelta || req.body.callbackRate
    };

    const isSpotOrder = req.body.isSpot === true || req.body.quoteOrderQty !== undefined;

    let result;
    if (isSpotOrder && exchangeId === 'hyperliquid' && (adapter as any).placeSpotOrder) {
      result = await (adapter as any).placeSpotOrder(params);
    } else {
      result = await adapter.placeOrder(params);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    log.error('Failed to place order', error);
    res.json({ success: false, error: error.message || 'Failed to place order' });
  }
}));

/**
 * Get open orders
 */
router.get('/', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const orders = await adapter.getOpenOrders(req.query.symbol as string);

  res.json({ success: true, data: orders });
}));

/**
 * Cancel all orders
 */
router.delete('/', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  if (!adapter.cancelAllOrders) {
    return res.json({ success: false, error: 'Exchange does not support cancel all' });
  }

  const result = await adapter.cancelAllOrders(req.query.symbol as string);
  res.json(result);
}));

/**
 * Get order history
 */
router.get('/history', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const orders = await adapter.getOrderHistory(req.query.symbol as string, limit);

  res.json({ success: true, data: orders });
}));

/**
 * Cancel single order
 */
router.delete('/:orderId', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const result = await adapter.cancelOrder(req.params.orderId, req.query.symbol as string);

  res.json({ success: true, data: result });
}));

export default router;
