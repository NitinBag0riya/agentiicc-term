/**
 * Ultra-Simple HTTP Server for Universal API Testing
 * Uses Bun's native HTTP server
 */

import { AsterAdapter } from './adapters/aster.adapter';
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';

const PORT = 3000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const params = url.searchParams;

    // CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    try {
      // Health check
      if (path === '/health') {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: Date.now() }),
          { headers }
        );
      }

      // Assets
      if (path === '/assets') {
        const exchange = params.get('exchange') || 'aster';
        
        const adapter = exchange === 'aster'
          ? new AsterAdapter('', '')
          : new HyperliquidAdapter('');

        const assets = await adapter.getAssets();
        
        return new Response(
          JSON.stringify({ success: true, exchange, data: assets }),
          { headers }
        );
      }

      // Assets search
      if (path === '/assets/search') {
        const searchTerm = params.get('q')?.toLowerCase() || '';
        
        const [asterAssets, hlAssets] = await Promise.all([
          new AsterAdapter('', '').getAssets(),
          new HyperliquidAdapter('').getAssets()
        ]);

        const filterAssets = (assets: any[]) => 
          assets.filter((a: any) => 
            a.symbol?.toLowerCase().includes(searchTerm) ||
            a.name?.toLowerCase().includes(searchTerm)
          );

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              aster: filterAssets(asterAssets),
              hyperliquid: filterAssets(hlAssets)
            }
          }),
          { headers }
        );
      }

      // Ticker
      const tickerMatch = path.match(/^\/ticker\/(.+)$/);
      if (tickerMatch) {
        const symbol = tickerMatch[1];
        const exchange = params.get('exchange') || 'aster';
        
        const adapter = exchange === 'aster'
          ? new AsterAdapter('', '')
          : new HyperliquidAdapter('');

        const ticker = await adapter.getTicker(symbol);
        
        return new Response(
          JSON.stringify({ success: true, exchange, data: ticker }),
          { headers }
        );
      }

      // Orderbook
      const orderbookMatch = path.match(/^\/orderbook\/(.+)$/);
      if (orderbookMatch) {
        const symbol = orderbookMatch[1];
        const exchange = params.get('exchange') || 'aster';
        const depth = parseInt(params.get('depth') || '20');
        
        const adapter = exchange === 'aster'
          ? new AsterAdapter('', '')
          : new HyperliquidAdapter('');

        const orderbook = await adapter.getOrderbook(symbol, depth);
        
        return new Response(
          JSON.stringify({ success: true, exchange, data: orderbook }),
          { headers }
        );
      }

      // 404
      return new Response(
        JSON.stringify({ success: false, error: 'Not found' }),
        { status: 404, headers }
      );

    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers }
      );
    }
  },
});

console.log(`\n🚀 Universal API Server running on http://localhost:${PORT}`);
console.log(`\n📚 Available endpoints:`);
console.log(`   GET  /health`);
console.log(`   GET  /assets?exchange={aster|hyperliquid}`);
console.log(`   GET  /assets/search?q={query}`);
console.log(`   GET  /ticker/:symbol?exchange={aster|hyperliquid}`);
console.log(`   GET  /orderbook/:symbol?exchange={aster|hyperliquid}&depth={number}`);
console.log();
