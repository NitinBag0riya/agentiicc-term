/**
 * Simplified Universal API Server
 * Works with both Aster and Hyperliquid
 */

import { Elysia } from 'elysia';
import { AsterAdapter } from '../adapters/aster.adapter';
import { HyperliquidAdapter } from '../adapters/hyperliquid.adapter';

export function createSimpleApiServer(port: number = 3000) {
  const app = new Elysia()
    // CORS
    .onRequest(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    })

    // Health check
    .get('/health', () => {
      return { status: 'ok', timestamp: Date.now() };
    })

    // Assets - supports both exchanges
    .get('/assets', async ({ query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        
        let adapter;
        if (exchange === 'aster') {
          adapter = new AsterAdapter('', '');
        } else if (exchange === 'hyperliquid') {
          adapter = new HyperliquidAdapter('');
        } else {
          return {
            success: false,
            error: 'Invalid exchange. Use aster or hyperliquid'
          };
        }

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

    // Assets search - both exchanges
    .get('/assets/search', async ({ query }: any) => {
      try {
        const searchTerm = query.q?.toLowerCase() || '';
        
        const [asterAssets, hlAssets] = await Promise.all([
          new AsterAdapter('', '').getAssets(),
          new HyperliquidAdapter('').getAssets()
        ]);

        const filterAssets = (assets: any[]) => 
          assets.filter(a => 
            a.symbol?.toLowerCase().includes(searchTerm) ||
            a.name?.toLowerCase().includes(searchTerm)
          );

        return {
          success: true,
          data: {
            aster: filterAssets(asterAssets),
            hyperliquid: filterAssets(hlAssets)
          }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    })

    // Ticker
    .get('/ticker/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        
        let adapter;
        if (exchange === 'aster') {
          adapter = new AsterAdapter('', '');
        } else if (exchange === 'hyperliquid') {
          adapter = new HyperliquidAdapter('');
        } else {
          return {
            success: false,
            error: 'Invalid exchange'
          };
        }

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

    // Orderbook
    .get('/orderbook/:symbol', async ({ params, query }: any) => {
      try {
        const exchange = query.exchange || 'aster';
        const depth = query.depth ? parseInt(query.depth) : 20;
        
        let adapter;
        if (exchange === 'aster') {
          adapter = new AsterAdapter('', '');
        } else if (exchange === 'hyperliquid') {
          adapter = new HyperliquidAdapter('');
        } else {
          return {
            success: false,
            error: 'Invalid exchange'
          };
        }

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

    // Start server
    .listen(port);

  console.log(`\n🚀 Universal API Server running on http://localhost:${port}`);
  console.log(`\n📚 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /assets?exchange={aster|hyperliquid}`);
  console.log(`   GET  /assets/search?q={query}`);
  console.log(`   GET  /ticker/:symbol?exchange={aster|hyperliquid}`);
  console.log(`   GET  /orderbook/:symbol?exchange={aster|hyperliquid}&depth={number}`);
  console.log();

  return app;
}
