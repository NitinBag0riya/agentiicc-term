/**
 * Unified Trading API Server
 * Provides normalized endpoints that work across all exchanges
 */

import { Elysia } from 'elysia';
import { AdapterFactory } from '../adapters/factory';
import { SessionStore } from '../middleware/session';
import { requireAuth } from '../middleware/auth';
import type { PlaceOrderParams } from '../adapters/base.adapter';

export function createApiServer(port: number = 3000) {
  const app = new Elysia()
    // CORS
    .onRequest(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    })

    // Health check
    .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))

    // ============ AUTH ============
    
    .post('/auth/session', async ({ body }: any) => {
      const { userId, exchangeId } = body;

      if (!userId || !exchangeId) {
        return { error: 'userId and exchangeId are required' };
      }

      const token = SessionStore.create(userId, exchangeId);
      
      return {
        success: true,
        token,
        expiresIn: '24h'
      };
    })

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
        const exchangeId = (query && query.exchange) || session.exchangeId;
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
        const exchangeId = body.exchange || session.exchangeId;
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
          leverage: body.leverage
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
        const adapter = await AdapterFactory.createAdapter(
          session.userId,
          session.exchangeId
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

    .get('/orders/history', requireAuth(async ({ session, query }: any) => {
      try {
        const exchangeId = (query && query.exchange) || session.exchangeId;
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
        const exchangeId = (query && query.exchange) || session.exchangeId;
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
          session.exchangeId
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
        const searchTerm = query.q?.toLowerCase() || '';
        
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
