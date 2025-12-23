/**
 * Main entry point - WEBHOOK MODE ONLY
 *
 * No polling mode - webhook only for scalability
 * Safe to run multiple instances
 */
import dotenv from 'dotenv';
import express from 'express';
import { connectRedis, disconnectRedis } from './db/redis';
import { connectPostgres, disconnectPostgres, initSchema } from './db/postgres';
import { logWebhook } from './db/webhookLogs';
import { initEncryption } from './utils/encryption';
import { createBot, setupBot } from './bot';
import { startExchangeInfoService, stopExchangeInfoService } from './services/exchangeInfo.service';
import { startPriceCacheService, stopPriceCacheService } from './services/priceCache.service';
import { spawn } from 'child_process';
// import { createProxyMiddleware } from 'http-proxy-middleware'; // Removed
import axios from 'axios';
import { setBotInfo } from './utils/botInfo';
import tgmaRouter from './tgma';

dotenv.config();

/**
 * Try to get ngrok URL from local ngrok API
 */
async function getNgrokUrl(): Promise<string | null> {
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (!response.ok) return null;
    const data = await response.json() as any;
    const tunnel = data.tunnels?.find((t: any) => t.proto === 'https') || data.tunnels?.[0];
    return tunnel?.public_url || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🤖 Starting Aster Trading Bot...\n');

  try {
    // Connect databases
    await connectRedis(process.env.REDIS_URL);
    await connectPostgres(process.env.DATABASE_URL);
    await initSchema();

    // Initialize encryption
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production';
    initEncryption(encryptionKey);

    // Get config
    const token = process.env.TELEGRAM_BOT_TOKEN;
    let webhookUrl = process.env.WEBHOOK_URL;

    // Dynamic ngrok detection if no URL set
    if (!webhookUrl || webhookUrl === 'polling') {
      const ngrokUrl = await getNgrokUrl();
      if (ngrokUrl) {
        console.log(`[Ngrok] 📡 Detected dynamic ngrok URL: ${ngrokUrl}`);
        webhookUrl = ngrokUrl;
        process.env.WEBHOOK_URL = ngrokUrl; // For fallback logic in bot.ts
      }
    }

    const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
    const port = parseInt(process.env.PORT || '3000');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found');
    }

    // Create bot
    const bot = createBot(token);
    setupBot(bot);

    // Fetch and store bot info
    const botInfo = await bot.telegram.getMe();
    setBotInfo(botInfo);
    console.log(`✅ Bot authenticated: @${botInfo.username} (${botInfo.first_name})\n`);

    // Set bot commands (menu displayed in Telegram)
    await bot.telegram.setMyCommands([
      { command: 'menu', description: 'Open main menu' },
      { command: 'help', description: 'Get help' },
    ]);
    console.log('[Bot] ✅ Command menu set');

    // Start exchange info service (fetch on startup, refresh every 10 mins)
    await startExchangeInfoService();

    // Start price cache service (fetch on startup, refresh every 10 mins)
    await startPriceCacheService();

    // Create Express app
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        instance: process.env.INSTANCE_ID || 'unknown',
        uptime: process.uptime(),
      });
    });

    // Mount TGMA router
    app.use('/tgma', tgmaRouter);

    // Serve mini-app static files
    app.use('/mini-app', express.static('tg-mini-webapp'));

    // --- START BACKEND INTEGRATION ---
    const BACKEND_PORT = 3001;
    console.log(`🚀 Spawning Backend Service on port ${BACKEND_PORT}...`);
    
    // Spawn Bun process for the backend
    const backendProcess = spawn('bun', ['run', 'src/server-bun.ts'], {
        cwd: './agentiicc-term',
        env: { ...process.env, PORT: String(BACKEND_PORT) },
        stdio: 'inherit' // Pipe output to main console
    });

    backendProcess.on('error', (err) => {
        console.error('❌ Failed to start Backend Service:', err);
    });

    // Proxy API requests to Backend (Manual Implementation since npm install fails)


    const apiProxy = async (req: express.Request, res: express.Response) => {
        try {
            const url = `http://localhost:${BACKEND_PORT}${req.originalUrl}`;
            // console.log('[Proxy]', req.method, url);
            
            const response = await axios({
                method: req.method,
                url: url,
                data: req.method !== 'GET' ? req.body : undefined,
                params: req.query,
                headers: { ...req.headers, host: `localhost:${BACKEND_PORT}` },
                validateStatus: () => true // Pass all statuses back
            });

            res.status(response.status).set(response.headers).send(response.data);
        } catch (error: any) {
            console.error('[Proxy Error]', error.message);
            res.status(502).json({ error: 'Backend API unavailable' });
        }
    };

    const apiPaths = [
        '/user', '/user/*', '/auth', '/auth/*', '/account', '/account/*',
        '/order', '/order/*', '/orders', '/orders/*', 
        '/positions', '/positions/*', '/ticker', '/ticker/*', 
        '/assets', '/assets/*', '/fills', '/fills/*', 
        '/ohlcv', '/ohlcv/*', '/orderbook', '/orderbook/*'
    ];
    
    // Mount proxy handler
    apiPaths.forEach(path => app.use(path, apiProxy));
    // --- END BACKEND INTEGRATION ---

    if (!webhookUrl || webhookUrl === 'polling') {
      console.log('⚠️ WEBHOOK_URL not found. Starting in POLLING mode...');
      
      // Log updates in polling mode too
      bot.use(async (ctx, next) => {
        logWebhook(ctx.update).catch(() => {});
        return next();
      });

      // Clear old webhook config if any
      await bot.telegram.deleteWebhook();
      
      bot.launch();
      console.log('✅ Bot started in polling mode!');
    } else {
      // Webhook secret validation middleware
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('WEBHOOK_SECRET not found (required for webhook mode)');
      }
  
      // Webhook endpoint with secret validation
      app.post(webhookPath, async (req, res) => {
        // Validate webhook secret
        const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
  
        if (receivedSecret !== webhookSecret) {
          console.warn('[Webhook] ❌ Invalid secret token received');
          return res.status(403).json({ error: 'Forbidden' });
        }
  
        // Log webhook payload (fire-and-forget for debugging)
        logWebhook(req.body).catch(() => {}); // Don't await - fire and forget
  
        await bot.handleUpdate(req.body, res);
      });
      
      // Register webhook with Telegram
      try {
        await bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`, { 
          secret_token: webhookSecret 
        });
        console.log('[Webhook] ✅ Webhook registered with Telegram');
      } catch (error) {
        console.error('[Webhook] ❌ Failed to register webhook:', error);
      }

      console.log(`🚀 Bot is running in WEBHOOK mode`);
      console.log(`📡 Webhook URL: ${webhookUrl}${webhookPath}`);
    }

    // Start server (for Health check & TGMA & Webhook)
    app.listen(port, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🏥 Health check: http://localhost:${port}/health`);
      console.log(`🔢 Instance ID: ${process.env.INSTANCE_ID || 'unknown'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n📡 Shutting down gracefully...');
      stopExchangeInfoService();
      stopPriceCacheService();
      await bot.stop();
      await disconnectRedis();
      await disconnectPostgres();
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    await disconnectRedis();
    await disconnectPostgres();
    process.exit(1);
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

main();
