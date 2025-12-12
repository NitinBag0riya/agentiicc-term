/**
 * Enhanced Universal API Server with Swagger Documentation
 */

import { Elysia } from 'elysia';
import { AsterAdapter } from '../adapters/aster.adapter';
import { HyperliquidAdapter } from '../adapters/hyperliquid.adapter';

// OpenAPI Specification
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Universal Trading API',
    version: '1.0.0',
    description: 'Unified API for trading across multiple exchanges (Aster & Hyperliquid)',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    }
  ],
  tags: [
    { name: 'System', description: 'System health and status' },
    { name: 'Market Data', description: 'Public market data endpoints' },
    { name: 'Assets', description: 'Asset information and search' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Check if the API server is running',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'number', example: 1765543493819 }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/assets': {
      get: {
        tags: ['Assets'],
        summary: 'Get all assets',
        description: 'Retrieve list of all tradable assets for a specific exchange',
        parameters: [
          {
            name: 'exchange',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['aster', 'hyperliquid'] },
            description: 'Exchange to query'
          }
        ],
        responses: {
          '200': {
            description: 'List of assets',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    exchange: { type: 'string' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          symbol: { type: 'string', example: 'ETHUSDT' },
                          name: { type: 'string', example: 'Ethereum' },
                          baseAsset: { type: 'string', example: 'ETH' },
                          quoteAsset: { type: 'string', example: 'USDT' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/assets/search': {
      get: {
        tags: ['Assets'],
        summary: 'Search assets',
        description: 'Search for assets across all exchanges',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Search query',
            example: 'ETH'
          }
        ],
        responses: {
          '200': {
            description: 'Search results from all exchanges',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        aster: { type: 'array' },
                        hyperliquid: { type: 'array' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/ticker/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get ticker data',
        description: 'Get current price and 24h statistics for a symbol',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Trading symbol',
            example: 'ETHUSDT'
          },
          {
            name: 'exchange',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['aster', 'hyperliquid'] },
            description: 'Exchange to query'
          }
        ],
        responses: {
          '200': {
            description: 'Ticker data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    exchange: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        symbol: { type: 'string' },
                        price: { type: 'string', example: '3240.50' },
                        change24h: { type: 'string' },
                        volume24h: { type: 'string' },
                        high24h: { type: 'string' },
                        low24h: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/orderbook/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get orderbook',
        description: 'Get current orderbook depth for a symbol',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Trading symbol',
            example: 'ETHUSDT'
          },
          {
            name: 'exchange',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['aster', 'hyperliquid'] }
          },
          {
            name: 'depth',
            in: 'query',
            schema: { type: 'integer', default: 20 },
            description: 'Number of price levels to return'
          }
        ],
        responses: {
          '200': {
            description: 'Orderbook data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    exchange: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        symbol: { type: 'string' },
                        bids: {
                          type: 'array',
                          items: {
                            type: 'array',
                            items: { type: 'string' }
                          },
                          example: [['3240.50', '1.5'], ['3240.00', '2.3']]
                        },
                        asks: {
                          type: 'array',
                          items: {
                            type: 'array',
                            items: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Swagger UI HTML
const swaggerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Trading API - Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css">
    <style>
        body { margin: 0; padding: 0; }
        .topbar { display: none; }
        .swagger-ui .info { margin: 50px 0; }
        .swagger-ui .info .title { font-size: 36px; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                spec: ${JSON.stringify(openApiSpec)},
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
`;

export function createApiServerWithDocs(port: number = 3000) {
  const app = new Elysia()
    // CORS
    .onRequest(({ set }) => {
      set.headers['Access-Control-Allow-Origin'] = '*';
      set.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      set.headers['Access-Control-Allow-Headers'] = 'Content-Type';
    })

    // Swagger Documentation
    .get('/docs/api', () => {
      return new Response(swaggerHTML, {
        headers: { 'Content-Type': 'text/html' }
      });
    })

    // OpenAPI JSON Spec
    .get('/openapi.json', () => openApiSpec)

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
          assets.filter((a: any) => 
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

  console.log(`\n🚀 Universal API Server with Swagger Docs running on http://localhost:${port}`);
  console.log(`\n📚 API Documentation: http://localhost:${port}/docs/api`);
  console.log(`📄 OpenAPI Spec: http://localhost:${port}/openapi.json`);
  console.log(`\n📊 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /assets?exchange={aster|hyperliquid}`);
  console.log(`   GET  /assets/search?q={query}`);
  console.log(`   GET  /ticker/:symbol?exchange={aster|hyperliquid}`);
  console.log(`   GET  /orderbook/:symbol?exchange={aster|hyperliquid}&depth={number}`);
  console.log();

  return app;
}
