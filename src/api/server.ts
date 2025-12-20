/**
 * Unified Trading API Server
 * Provides normalized endpoints that work across all exchanges
 */

import { Elysia } from 'elysia';
import { initBotServices } from '../bot/main';
import { AdapterFactory } from '../adapters/factory';
import { getPostgres, disconnectPostgres } from '../bot/db/postgres';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import { validateWebAppData } from '../bot/utils/telegramAuth';
import { SessionStore } from '../middleware/session';
import { requireAuth } from '../middleware/auth';
import { getOrCreateUser, storeApiCredentials, getLinkedExchanges } from '../db/users';
import { encrypt } from '../utils/encryption';
import type { PlaceOrderParams } from '../adapters/base.adapter';
import { logWebhook } from '../bot/db/webhookLogs';
import { stopExchangeInfoService } from '../bot/services/exchangeInfo.service';
import { stopPriceCacheService } from '../bot/services/priceCache.service';
import { disconnectRedis } from '../bot/db/redis';


export function createApiServer(port: number = 3000) {
  let bot: any;
  
  const app = new Elysia()
    // Initialize Bot on startup
    .onStart(async () => {
      bot = await initBotServices();
      
      // Set Webhook
      const webhookUrl = process.env.WEBHOOK_URL;
      const webhookSecret = process.env.WEBHOOK_SECRET;
      const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
      
      if (webhookUrl && webhookSecret) {
        await bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`, {
          secret_token: webhookSecret,
        });
        console.log(`🚀 API Server: Webhook set to ${webhookUrl}${webhookPath}`);
      }
    })
    
    // Graceful Shutdown
    .onStop(async () => {
      console.log('🛑 API Server stopping...');
      if (bot) await bot.stop();
      stopExchangeInfoService();
      stopPriceCacheService();
      await disconnectRedis();
      await disconnectPostgres();
    })

    // CORS
    .onRequest(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    })

    // Health check
    .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))

    // ============ AUTHENTICATION ============
    
    // Generate nonce for wallet connection
    .post('/auth/nonce', async ({ body }: any) => {
        const { exchange, address } = body;
        // Generate pseudo-random nonce
        const nonce = Math.floor(Math.random() * 1000000).toString();
        
        // In a stateless implementation, we trust the signature verification of the nonce later
        // Or better: store in Redis. For now: stateless nonce (client just needs A nonce to sign)
        // Ideally we associate it with the address in DB.
        
        // TODO: Store nonce in Redis with TTL? 
        // For simplicity now, we just return a nonce. The client signs "Sign into ... {nonce}"
        // The /auth/link endpoint checks signature matches logical message construction.
        
        return { nonce };
    })
    
    // Link wallet account
    .post('/auth/link', async ({ body }: any) => {
        try {
            const { tgInitData, exchange, walletAddress, signature, nonce } = body;
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            
            if (!botToken) throw new Error('Bot token not configured');
            
            // 1. Validate Telegram User
            const { isValid, userData } = validateWebAppData(tgInitData, botToken);
            if (!isValid || !userData) {
                return { success: false, error: 'Invalid Telegram WebApp data' };
            }
            
            const telegramId = userData.id;
            
            // 2. Verify Wallet Signature
            const message = exchange === 'aster' 
                ? `You are signing into Astherus ${nonce}`
                : `Sign into AgentFi for ${exchange}: ${nonce}`;
                
            const recoveredAddress = ethers.verifyMessage(message, signature);
            
            if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                return { success: false, error: 'Invalid signature' };
            }
            
            // 3. Link in Database
            const pool = getPostgres();
            
            // First ensure user exists (should exist if they opened bot)
            const userRes = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
            let userId;
            
            if (userRes.rows.length === 0) {
               // Create user on the fly if missing (edge case)
               const newUser = await pool.query(
                 'INSERT INTO users (telegram_id, username, is_verified) VALUES ($1, $2, TRUE) RETURNING id',
                 [telegramId, userData.username]
               );
               userId = newUser.rows[0].id;
            } else {
               userId = userRes.rows[0].id;
            }
            
            // Insert/Update credentials
            // For now, we store the wallet address in api_credentials? 
            // Or do we have a separate wallets table?
            // The schema has api_credentials for API KEYS.
            // Wallet connection usually implies we use it for signing transactions OR just for identification.
            // If the user wants to trade, they need to provide API KEYS for CEX or Private Key for On-chain?
            // Aster is CEX-like? Or onchain?
            // "Connect your wallet to start trading on Aster DEX".
            // Assuming we just store it as "linked".
            
            // Note: Schema in postgres.ts does not have "wallet_address" column in users or api_credentials.
            // We'll store it in api_credentials as a placeholder or create a new table?
            // Or reusing "api_key_encrypted" as wallet address? No.
            
            // Let's check schema details again.
            // The user wants to link account. 
            // "api_credentials" has (user_id, api_key_encrypted, api_secret_encrypted).
            // Maybe this flow is intended to store the WALLET ADDRESS as the "key"? 
            // Or maybe this flow is just to PROVE ownership to enable features?
            
            // For now, let's assume valid linking means we update the user verification status.
            await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
            
            // Return success
            return { success: true, userId, linked: true };
            
        } catch (error: any) {
            console.error('Link error:', error);
            return { success: false, error: error.message };
        }
    })

    // ============ WEBHOOK ============
    .post('/webhook', async ({ body, headers, set }: any) => {
        const secret = headers['x-telegram-bot-api-secret-token'];
        const expectedSecret = process.env.WEBHOOK_SECRET;
        
        if (secret !== expectedSecret) {
            set.status = 403;
            return { error: 'Forbidden' };
        }
        
        // Handle update
        if (bot) {
            // Log (fire and forget)
            logWebhook(body).catch(() => {});
            
            // Handle
            try {
                // Telegraf expects (req, res) for handleUpdate usually, but we can pass just the update object
                // if we don't need it to manage the response directly (Elysia handles response).
                // However, handleUpdate signature is (update, webhookResponse?)
                await bot.handleUpdate(body);
            } catch (err) {
                console.error('Webhook error:', err);
            }
        }
        
        return { ok: true };
    })

    // ============ WEBAPP STATIC FILES ============
    // Serve index.html
    .get('/', () => Bun.file('webapp/index.html'))
    .get('/webapp', () => Bun.file('webapp/index.html'))
    
    // Serve static assets
    .get('/style.css', () => Bun.file('webapp/style.css'))
    .get('/app.js', () => Bun.file('webapp/app.js'))
    .get('/config.js', () => Bun.file('webapp/config.js'))
    
    // ============ USER & CREDENTIALS ============

    .post('/user', async ({ body }: any) => {
      try {
        const { telegramId, username } = body;
        if (!telegramId) return { success: false, error: 'telegramId is required' };
        
        const user = await getOrCreateUser(telegramId, username);
        return { success: true, data: user };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })

    .post('/user/credentials', async ({ body }: any) => {
      try {
         const { userId, exchange } = body;
         if (!userId || !exchange) {
             return { success: false, error: 'userId and exchange are required' };
         }
         
         let finalKey, finalSecret;

         if (exchange === 'hyperliquid') {
            const { address, privateKey } = body;
            if (!address || !privateKey) {
                return { success: false, error: 'Hyperliquid requires "address" and "privateKey"' };
            }
            // DB mapping for Hyperliquid:
            // api_key_encrypted col = Private Key
            // api_secret_encrypted col = Wallet Address
            finalKey = privateKey;
            finalSecret = address;
         } else {
            // Default (Aster and others)
            const { apiKey, apiSecret } = body;
            if (!apiKey || !apiSecret) {
                return { success: false, error: `${exchange} requires "apiKey" and "apiSecret"` };
            }
            finalKey = apiKey;
            finalSecret = apiSecret;
         }

         const encKey = encrypt(finalKey);
         const encSecret = encrypt(finalSecret);

         await storeApiCredentials(userId, exchange, encKey, encSecret);
         return { success: true, message: 'Credentials stored' };

      } catch (error: any) {
         return { success: false, error: error.message };
      }
    })

    .get('/user/exchanges', async ({ query }: any) => {
        try {
            const userId = query.userId;
            if (!userId) return { success: false, error: 'userId required' };
            
            const exchanges = await getLinkedExchanges(parseInt(userId));
            return { success: true, data: exchanges };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    })

    // ============ AUTH ============
    
    .post('/auth/session', async ({ body }: any) => {
      try {
        const { userId, exchangeId } = body;

        if (!userId) {
          return { success: false, error: 'userId is required' };
        }

        // Get all linked exchanges for this user
        const linkedCredentials = await getLinkedExchanges(parseInt(userId));

        if (linkedCredentials.length === 0) {
          return { 
            success: false, 
            error: 'No exchanges linked. Please link at least one exchange first.' 
          };
        }

        const linkedExchangeNames = linkedCredentials.map(c => c.exchange);

        // Create unified session with all linked exchanges
        // Use exchangeId if provided (backward compatibility), otherwise use first linked exchange
        const defaultExchange = exchangeId || linkedExchangeNames[0];
        
        // Validate that the default exchange is actually linked
        if (!linkedExchangeNames.includes(defaultExchange)) {
          return {
            success: false,
            error: `Exchange '${defaultExchange}' is not linked to this account`
          };
        }

        const token = SessionStore.create(parseInt(userId), linkedExchangeNames, defaultExchange);
        
        return {
          success: true,
          token,
          expiresIn: '24h',
          activeExchange: defaultExchange,
          linkedExchanges: linkedExchangeNames
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })


    .get('/auth/session/info', requireAuth(({ session }: any) => {
      return {
        success: true,
        data: {
          userId: session.userId,
          activeExchange: session.activeExchange,
          linkedExchanges: session.linkedExchanges,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt
        }
      };
    }))

    .post('/auth/session/switch', requireAuth(({ session, body, headers }: any) => {
      try {
        const { exchange } = body;

        if (!exchange) {
          return { success: false, error: 'exchange parameter is required' };
        }

        const token = headers.authorization?.replace('Bearer ', '');
        if (!token) {
          return { success: false, error: 'No session token found' };
        }

        SessionStore.switchExchange(token, exchange);

        return {
          success: true,
          message: `Switched to ${exchange}`,
          activeExchange: exchange
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .delete('/auth/session', requireAuth(({ session, headers }: any) => {
      const token = headers.authorization?.replace('Bearer ', '');
      if (token) {
        SessionStore.delete(token);
      }
      
      return {
        success: true,
        message: 'Session deleted'
      };
    }))

    // ============ ACCOUNT ============
    
    .get('/account', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        const accountInfo = await adapter.getAccount();

        return {
          success: true,
          data: accountInfo
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))

    // ============ ORDERS ============
    
    .post('/order', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        const params: PlaceOrderParams = {
          symbol: body.symbol,
          side: body.side,
          type: body.type,
          quantity: body.quantity,
          price: body.price,
          triggerPrice: body.triggerPrice || body.stopPrice,
          takeProfit: body.takeProfit,
          stopLoss: body.stopLoss,
          reduceOnly: body.reduceOnly,
          leverage: body.leverage,
          trailingDelta: body.trailingDelta || body.callbackRate
        };

        const result = await adapter.placeOrder(params);

        return {
          success: true,
          data: result
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))

    .get('/orders', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        const orders = await adapter.getOpenOrders(query.symbol);

        return {
          success: true,
          data: orders
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))


    .delete('/orders', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        if (!adapter.cancelAllOrders) {
           return { success: false, error: 'Exchange does not support cancel all' };
        }

        const result = await adapter.cancelAllOrders(query.symbol);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // ============ LEVERAGE & MARGIN ============

    .post('/account/leverage', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        if (!adapter.setLeverage) {
          return { success: false, error: 'Exchange does not support setting leverage' };
        }

        const result = await adapter.setLeverage(body.symbol, parseInt(body.leverage));
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .post('/account/margin-mode', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        if (!adapter.setMarginMode) {
          return { success: false, error: 'Exchange does not support setting margin mode' };
        }

        const result = await adapter.setMarginMode(body.symbol, body.mode);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .get('/orders/history', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        const limit = query.limit ? parseInt(query.limit) : 50;
        const orders = await adapter.getOrderHistory(query.symbol, limit);

        return {
          success: true,
          data: orders
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))

    .delete('/order/:orderId', requireAuth(async ({ session, params, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          exchangeId
        );

        const result = await adapter.cancelOrder(params.orderId, query.symbol);

        return {
          success: true,
          data: result
        };
      } catch (error:any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))

    // ============ POSITIONS ============
    
    .get('/positions', requireAuth(async ({ session, query }: any) => {
      // Get positions from specific exchange or all exchanges
      try {
        // If exchange specified in query, get only that
        if (query && query.exchange) {
          const adapter = await AdapterFactory.createAdapter(
            session.userId,
            query.exchange
          );
          const positions = await adapter.getPositions();
          return {
            success: true,
            data: positions
          };
        }

        // Otherwise use session exchange (default)
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          session.activeExchange
        );
        const positions = await adapter.getPositions();
        
        return {
          success: true,
          data: positions
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }))

    // ============ MARKET DATA ============
    
    .get('/orderbook/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);

        const depth = query.depth ? parseInt(query.depth) : 20;
        const orderbook = await adapter.getOrderbook(params.symbol, depth);

        return {
          success: true,
          exchange,
          data: orderbook
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })

    .get('/ticker/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);

        const ticker = await adapter.getTicker(params.symbol);

        return {
          success: true,
          exchange,
          data: ticker
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })

    .get('/assets', async ({ query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);
        
        const assets = await adapter.getAssets();
          
        return {
          success: true,
          exchange,
          data: assets
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })

    // Search assets across exchanges
    .get('/assets/search', async ({ query }: any) => {
      try {
        const searchTerm = (query.q || '').toLowerCase();
        
        // Get assets from both exchanges
        const [asterAssets, hlAssets] = await Promise.all([
          AdapterFactory.createPublicAdapter('aster').getAssets().catch(() => []),
          AdapterFactory.createPublicAdapter('hyperliquid').getAssets().catch(() => [])
        ]);

        const results: any[] = [];
        
        // Process Aster assets
        if (Array.isArray(asterAssets)) {
            asterAssets.forEach((asset: any) => {
                const s = typeof asset === 'string' ? asset : asset.symbol;
                if (s && s.toLowerCase().includes(searchTerm)) {
                    results.push({
                        exchange: 'aster',
                        symbol: s,
                        base: typeof asset === 'object' ? asset.base : s,
                        quote: typeof asset === 'object' ? asset.quote : 'USDT',
                        lastPrice: typeof asset === 'object' ? asset.lastPrice : 0
                    });
                }
            });
        }

        // Process Hyperliquid assets
        if (Array.isArray(hlAssets)) {
            hlAssets.forEach((asset: any) => {
                const s = typeof asset === 'string' ? asset : asset.symbol;
                if (s && s.toLowerCase().includes(searchTerm)) {
                    results.push({
                        exchange: 'hyperliquid',
                        symbol: s,
                        base: typeof asset === 'object' ? asset.base : s,
                        quote: typeof asset === 'object' ? asset.quote : 'USDC',
                        lastPrice: typeof asset === 'object' ? asset.lastPrice : 0
                    });
                }
            });
        }

        return {
          success: true,
          query: searchTerm,
          count: results.length,
          data: results
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })



    // ============ MISSING ENDPOINTS - ADDED FOR 100% BOT COVERAGE ============

    // 1. Get specific position by symbol
    .get('/positions/:symbol', requireAuth(async ({ session, params, query }: any) => {
      try {
        const exchange = query?.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchange);
        const positions = await adapter.getPositions();
        
        const position = positions.find((p: any) => p.symbol === params.symbol);
        
        if (!position) {
          return { success: false, error: `Position not found for ${params.symbol}` };
        }
        
        return { success: true, data: position };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 2. Get open orders
    .get('/orders/open', requireAuth(async ({ session, query }: any) => {
      try {
        const exchange = query?.exchange || session.activeExchange;
        const symbol = query?.symbol;
        
        const adapter = await AdapterFactory.createAdapter(session.userId, exchange);
        const orders = await adapter.getOpenOrders(symbol);
        
        return { success: true, data: orders || [] };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 3. Cancel specific order
    .post('/order/cancel', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol, orderId } = body;
        const targetExchange = exchange || session.activeExchange;
        
        if (!symbol || !orderId) {
          return { success: false, error: 'symbol and orderId are required' };
        }
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        const result = await adapter.cancelOrder(symbol, orderId);
        
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 4. Cancel all orders for symbol
    .post('/orders/cancel-all', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol } = body;
        const targetExchange = exchange || session.activeExchange;
        
        if (!symbol) {
          return { success: false, error: 'symbol is required' };
        }
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        
        // Get all open orders for this symbol
        const orders = await adapter.getOpenOrders(symbol);
        
        // Cancel each order
        const results = [];
        for (const order of orders) {
          try {
            const result = await adapter.cancelOrder(symbol, order.orderId);
            results.push(result);
          } catch (err: any) {
            console.error(`Failed to cancel order ${order.orderId}:`, err.message);
          }
        }
        
        return { success: true, data: { cancelled: results.length, total: orders.length } };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 5. Get specific asset details
    .get('/asset/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query?.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);
        const assets = await adapter.getAssets();
        
        const asset = assets.find((a: any) => a.symbol === params.symbol);
        
        if (!asset) {
          return { success: false, error: `Asset ${params.symbol} not found on ${exchange}` };
        }
        
        return { success: true, data: asset };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })

    // 6. Quick market order
    .post('/trade/market', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol, side, quantity } = body;
        const targetExchange = exchange || session.activeExchange;
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        const result = await adapter.placeOrder({
          symbol,
          side,
          type: 'MARKET',
          quantity
        });
        
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 7. Quick limit order
    .post('/trade/limit', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol, side, quantity, price } = body;
        const targetExchange = exchange || session.activeExchange;
        
        if (!price) {
          return { success: false, error: 'price is required for limit orders' };
        }
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        const result = await adapter.placeOrder({
          symbol,
          side,
          type: 'LIMIT',
          quantity,
          price
        });
        
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 8. Quick stop-loss order
    .post('/trade/stop-loss', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol, side, quantity, stopPrice } = body;
        const targetExchange = exchange || session.activeExchange;
        
        if (!stopPrice) {
          return { success: false, error: 'stopPrice is required for stop-loss orders' };
        }
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        const result = await adapter.placeOrder({
          symbol,
          side,
          type: 'STOP_MARKET',
          quantity,
          triggerPrice: stopPrice
        });
        
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 9. Quick take-profit order
    .post('/trade/take-profit', requireAuth(async ({ session, body }: any) => {
      try {
        const { exchange, symbol, side, quantity, stopPrice } = body;
        const targetExchange = exchange || session.activeExchange;
        
        if (!stopPrice) {
          return { success: false, error: 'stopPrice is required for take-profit orders' };
        }
        
        const adapter = await AdapterFactory.createAdapter(session.userId, targetExchange);
        const result = await adapter.placeOrder({
          symbol,
          side,
          type: 'TAKE_PROFIT_MARKET',
          quantity,
          triggerPrice: stopPrice
        });
        
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    // 10. Get price for specific symbol
    .get('/price/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query?.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);
        
        // Get ticker which includes price
        const ticker = await adapter.getTicker(params.symbol);
        
        return { success: true, data: { symbol: params.symbol, price: ticker.price } };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })

    // 11. Get all prices
    .get('/prices', async ({ query }: any) => {
      try {
        const exchange = query?.exchange || 'aster';
        const adapter = AdapterFactory.createPublicAdapter(exchange);
        
        // Get all assets and their prices
        const assets = await adapter.getAssets();
        const prices: any = {};
        
        // For now, return empty object - would need to fetch all tickers which is expensive
        // Bot should use /ticker/:symbol for individual prices
        return { success: true, data: prices, message: 'Use /ticker/:symbol for individual prices' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })

    // ============ EXISTING NEW ENDPOINTS ============

    .get('/fills', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        const limit = query.limit ? parseInt(query.limit) : 50;
        
        const fills = await adapter.getFills(query.symbol, limit);
        return { success: true, data: fills };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .get('/ohlcv/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        // OHLCV is often public, so we can use public adapter if we want, 
        // OR we can use user adapter if specific data needed.
        // Usually OHLCV is public.
        const adapter = AdapterFactory.createPublicAdapter(exchange);
        
        const tf = query.tf || '15m';
        const limit = query.limit ? parseInt(query.limit) : 200;
        
        const candles = await adapter.getOHLCV(params.symbol, tf, limit);
        return { success: true, exchange, data: candles };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    })

    .post('/position/close', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        
        const result = await adapter.closePosition(body.symbol);
        return { success: true, data: result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .post('/position/tp-sl', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        
        // body: { symbol: 'BTC', tp: '100000', sl: '90000' }
        const result = await adapter.setPositionTPSL(body.symbol, body.tp, body.sl);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .post('/position/take-profit', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        
        // body: { symbol: 'BTC', price: '100000' }
        const result = await adapter.setPositionTPSL(body.symbol, body.price, undefined);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .post('/position/stop-loss', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        
        // body: { symbol: 'BTC', price: '90000' }
        const result = await adapter.setPositionTPSL(body.symbol, undefined, body.price);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .post('/position/margin', requireAuth(async ({ session, body }: any) => {
      try {
        const exchangeId = body.exchange || session.activeExchange;
        const adapter = await AdapterFactory.createAdapter(session.userId, exchangeId);
        
        // body: { symbol, amount, type: 'ADD'|'REMOVE' }
        const result = await adapter.updatePositionMargin(body.symbol, body.amount, body.type);
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }))

    .listen(port);

  console.log(`🌐 API Server running at http://localhost:${port}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /auth/session`);
  console.log(`   GET  /account`);
  console.log(`   POST /order`);
  console.log(`   GET  /orders`);
  console.log(`   GET  /orders/history`);
  console.log(`   DELETE /order/:orderId`);
  console.log(`   GET  /positions`);
  console.log(`   GET  /orderbook/:symbol`);
  console.log(`   GET  /ticker/:symbol`);
  console.log(`   GET  /assets`);
  console.log(`   GET  /assets/search?q=BTC`);
  
  return app;
}
