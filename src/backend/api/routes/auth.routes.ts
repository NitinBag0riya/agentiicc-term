/**
 * Authentication Routes
 * 
 * Session management and authentication endpoints.
 */

import { Router, Request, Response } from 'express';
import { SessionStore } from '../../middleware/session';
import { requireAuth } from '../../middleware/auth';
import { getOrCreateUser, storeApiCredentials, getLinkedExchanges } from '../../../db/users';
import { encrypt } from '../../utils/encryption';

const router = Router();

/**
 * Create or get user
 */
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

/**
 * Store exchange credentials
 */
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
      finalKey = privateKey;
      finalSecret = address;
    } else {
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

/**
 * Get user's linked exchanges
 */
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

/**
 * Create session
 */
router.post('/auth/session', async (req: Request, res: Response) => {
  try {
    const { userId, exchangeId } = req.body;

    if (!userId) {
      return res.json({ success: false, error: 'userId is required' });
    }

    const linkedExchanges = await getLinkedExchanges(parseInt(userId));

    if (linkedExchanges.length === 0) {
      return res.json({ 
        success: false, 
        error: 'No exchanges linked. Please link at least one exchange first.' 
      });
    }

    const defaultExchange = exchangeId || linkedExchanges[0];
    
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

/**
 * Get session info
 */
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

/**
 * Switch active exchange
 */
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

/**
 * Delete session
 */
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

export default router;
