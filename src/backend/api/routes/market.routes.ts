/**
 * Market Data Routes
 * 
 * Public market data endpoints (no auth required).
 */

import { Router, Request, Response } from 'express';
import { AdapterFactory } from '../../adapters/factory';
import { withAuth } from '../../middleware/auth';

const router = Router();

/**
 * Get orderbook
 */
router.get('/orderbook/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);

    const depth = req.query.depth ? parseInt(req.query.depth as string) : 20;
    const orderbook = await adapter.getOrderbook(req.params.symbol, depth);

    res.json({ success: true, exchange, data: orderbook });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Get ticker
 */
router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);

    const ticker = await adapter.getTicker(req.params.symbol);

    res.json({ success: true, exchange, data: ticker });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Get all assets
 */
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);
    
    const assets = await adapter.getAssets();
      
    res.json({ success: true, exchange, data: assets });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Search assets across exchanges
 */
router.get('/assets/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = ((req.query.q as string) || '').toLowerCase();
    
    const [asterAssets, hlAssets] = await Promise.all([
      AdapterFactory.createPublicAdapter('aster').getAssets(),
      AdapterFactory.createPublicAdapter('hyperliquid').getAssets()
    ]);

    const results = [
      ...asterAssets
        .filter((a: any) => 
          a.symbol.toLowerCase().includes(searchTerm) || 
          a.name.toLowerCase().includes(searchTerm)
        )
        .map((a: any) => ({ ...a, exchange: 'aster' })),
      ...hlAssets
        .filter((a: any) => 
          a.symbol.toLowerCase().includes(searchTerm) || 
          a.name.toLowerCase().includes(searchTerm)
        )
        .map((a: any) => ({ ...a, exchange: 'hyperliquid' }))
    ];

    res.json({ success: true, query: searchTerm, count: results.length, data: results });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

/**
 * Get fills (requires auth)
 */
router.get('/fills', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId!);
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  
  const fills = await adapter.getFills(req.query.symbol as string, limit);
  res.json({ success: true, data: fills });
}));

/**
 * Get OHLCV candles
 */
router.get('/ohlcv/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);
    
    const tf = (req.query.tf as string) || '15m';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
    
    const candles = await adapter.getOHLCV(req.params.symbol, tf, limit);
    res.json({ success: true, exchange, data: candles });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

export default router;
