/**
 * Unified Trading API Routes (Express)
 * Provides normalized endpoints that work across all exchanges
 */

import { Router, Request, Response } from 'express';
import { AdapterFactory } from '../adapters/factory';
import { SessionStore } from '../middleware/session';
import { requireAuth, withAuth } from '../middleware/auth';
import { getOrCreateUser, storeApiCredentials, getLinkedExchanges } from '../../db/users';
import { encrypt } from '../utils/encryption';
import type { PlaceOrderParams } from '../adapters/base.adapter';

const router = Router();

// ============ HEALTH CHECK ============

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ============ USER & CREDENTIALS ============

router.post('/user', async (req: Request, res: Response) => {
  try {
    const { telegramId, username } = req.body;
    if (!telegramId) {
      return res.json({ success: false, error: 'telegramId is required' });
    }
    
    const user = await getOrCreateUser(telegramId, username);
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.post('/user/credentials', async (req: Request, res: Response) => {
  try {
    const { userId, exchange } = req.body;
    if (!userId || !exchange) {
      return res.json({ success: false, error: 'userId and exchange are required' });
    }
    
    let finalKey, finalSecret;

    if (exchange === 'hyperliquid') {
      const { address, privateKey } = req.body;
      if (!address || !privateKey) {
        return res.json({ success: false, error: 'Hyperliquid requires "address" and "privateKey"' });
      }
      // DB mapping for Hyperliquid:
      // api_key_encrypted col = Private Key
      // api_secret_encrypted col = Wallet Address
      finalKey = privateKey;
      finalSecret = address;
    } else {
      // Default (Aster and others)
      const { apiKey, apiSecret } = req.body;
      if (!apiKey || !apiSecret) {
        return res.json({ success: false, error: `${exchange} requires "apiKey" and "apiSecret"` });
      }
      finalKey = apiKey;
      finalSecret = apiSecret;
    }

    const encKey = encrypt(finalKey);
    const encSecret = encrypt(finalSecret);

    await storeApiCredentials(userId, encKey, encSecret, false, exchange);
    res.json({ success: true, message: 'Credentials stored' });

  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/user/exchanges', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.json({ success: false, error: 'userId required' });
    }
    
    const exchanges = await getLinkedExchanges(parseInt(userId));
    res.json({ success: true, data: exchanges });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

// ============ AUTH ============

router.post('/auth/session', async (req: Request, res: Response) => {
  try {
    const { userId, exchangeId } = req.body;

    if (!userId) {
      return res.json({ success: false, error: 'userId is required' });
    }

    // Get all linked exchanges for this user
    const linkedExchanges = await getLinkedExchanges(parseInt(userId));

    if (linkedExchanges.length === 0) {
      return res.json({ 
        success: false, 
        error: 'No exchanges linked. Please link at least one exchange first.' 
      });
    }

    // Create unified session with all linked exchanges
    // Use exchangeId if provided (backward compatibility), otherwise use first linked exchange
    const defaultExchange = exchangeId || linkedExchanges[0];
    
    // Validate that the default exchange is actually linked
    if (!linkedExchanges.includes(defaultExchange)) {
      return res.json({
        success: false,
        error: `Exchange '${defaultExchange}' is not linked to this account`
      });
    }

    const token = SessionStore.create(parseInt(userId), linkedExchanges, defaultExchange);
    
    res.json({
      success: true,
      token,
      expiresIn: '24h',
      activeExchange: defaultExchange,
      linkedExchanges
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.get('/auth/session/info', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      userId: req.session?.userId,
      activeExchange: req.session?.activeExchange,
      linkedExchanges: req.session?.linkedExchanges,
      createdAt: req.session?.createdAt,
      expiresAt: req.session?.expiresAt
    }
  });
});

router.post('/auth/session/switch', requireAuth, (req: Request, res: Response) => {
  try {
    const { exchange } = req.body;

    if (!exchange) {
      return res.json({ success: false, error: 'exchange parameter is required' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.json({ success: false, error: 'No session token found' });
    }

    SessionStore.switchExchange(token, exchange);

    res.json({
      success: true,
      message: `Switched to ${exchange}`,
      activeExchange: exchange
    });
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  }
});

router.delete('/auth/session', requireAuth, (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    SessionStore.delete(token);
  }
  
  res.json({
    success: true,
    message: 'Session deleted'
  });
});

// ============ ACCOUNT ============

router.get('/account', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const accountInfo = await adapter.getAccount();

  res.json({
    success: true,
    data: accountInfo
  });
}));

// ============ ORDERS ============

router.post('/order', withAuth(async (req: Request, res: Response) => {
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

  const result = await adapter.placeOrder(params);

  res.json({
    success: true,
    data: result
  });
}));

router.get('/orders', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const orders = await adapter.getOpenOrders(req.query.symbol as string);

  res.json({
    success: true,
    data: orders
  });
}));

router.delete('/orders', withAuth(async (req: Request, res: Response) => {
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

router.get('/orders/history', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const orders = await adapter.getOrderHistory(req.query.symbol as string, limit);

  res.json({
    success: true,
    data: orders
  });
}));

router.delete('/order/:orderId', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const result = await adapter.cancelOrder(req.params.orderId, req.query.symbol as string);

  res.json({
    success: true,
    data: result
  });
}));

// ============ LEVERAGE & MARGIN ============

router.post('/account/leverage', withAuth(async (req: Request, res: Response) => {
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

router.post('/account/margin-mode', withAuth(async (req: Request, res: Response) => {
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

// ============ POSITIONS ============

router.get('/positions', withAuth(async (req: Request, res: Response) => {
  // Get positions from specific exchange or active exchange
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(
    req.session!.userId,
    exchangeId!
  );

  const positions = await adapter.getPositions();
  
  res.json({
    success: true,
    data: positions
  });
}));

router.post('/position/tp-sl', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  // body: { symbol: 'BTC', tp: '100000', sl: '90000' }
  const result = await adapter.setPositionTPSL(req.body.symbol, req.body.tp, req.body.sl);
  res.json(result);
}));

router.post('/position/take-profit', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  // body: { symbol: 'BTC', price: '100000' }
  const result = await adapter.setPositionTPSL(req.body.symbol, req.body.price, undefined);
  res.json(result);
}));

router.post('/position/stop-loss', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  // body: { symbol: 'BTC', price: '90000' }
  const result = await adapter.setPositionTPSL(req.body.symbol, undefined, req.body.price);
  res.json(result);
}));

router.post('/position/margin', withAuth(async (req: Request, res: Response) => {
  const exchangeId = req.body.exchange || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId);
  
  // body: { symbol, amount, type: 'ADD'|'REMOVE' }
  const result = await adapter.updatePositionMargin(req.body.symbol, req.body.amount, req.body.type);
  res.json(result);
}));

// ============ MARKET DATA (Public) ============

router.get('/orderbook/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);

    const depth = req.query.depth ? parseInt(req.query.depth as string) : 20;
    const orderbook = await adapter.getOrderbook(req.params.symbol, depth);

    res.json({
      success: true,
      exchange,
      data: orderbook
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);

    const ticker = await adapter.getTicker(req.params.symbol);

    res.json({
      success: true,
      exchange,
      data: ticker
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

router.get('/assets', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    const adapter = AdapterFactory.createPublicAdapter(exchange);
    
    const assets = await adapter.getAssets();
      
    res.json({
      success: true,
      exchange,
      data: assets
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Search assets across exchanges
router.get('/assets/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = ((req.query.q as string) || '').toLowerCase();
    
    // Get assets from both exchanges
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

    res.json({
      success: true,
      query: searchTerm,
      count: results.length,
      data: results
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

router.get('/fills', withAuth(async (req: Request, res: Response) => {
  const exchangeId = (req.query.exchange as string) || req.session?.activeExchange;
  const adapter = await AdapterFactory.createAdapter(req.session!.userId, exchangeId!);
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  
  const fills = await adapter.getFills(req.query.symbol as string, limit);
  res.json({ success: true, data: fills });
}));

router.get('/ohlcv/:symbol', async (req: Request, res: Response) => {
  try {
    const exchange = (req.query.exchange as string) || 'aster';
    // OHLCV is often public, so we can use public adapter
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
