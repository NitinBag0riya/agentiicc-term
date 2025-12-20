/**
 * Main entry point - WEBHOOK MODE ONLY
 *
 * No polling mode - webhook only for scalability
 * Safe to run multiple instances
 */
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { connectRedis, disconnectRedis } from './db/redis';
import { connectPostgres, disconnectPostgres, initSchema } from './db/postgres';
import { logWebhook } from './db/webhookLogs';
import { initEncryption } from './utils/encryption';
import { createBot, setupBot } from './bot';
import { startExchangeInfoService, stopExchangeInfoService } from './services/exchangeInfo.service';
import { startPriceCacheService, stopPriceCacheService } from './services/priceCache.service';
import { setBotInfo } from './utils/botInfo';
// Note: Legacy compatibility exports were removed.
// All consumers should use the exchange-parameterized versions.

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

// Exported for API server integration
export async function initBotServices() {
  console.log('🤖 Initializing StableSolid Bot Services...\n');

  try {
    // Connect databases
    await connectRedis(process.env.REDIS_URL);
    await connectPostgres(process.env.DATABASE_URL);
    await initSchema();

    // Initialize encryption
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production';
    initEncryption(encryptionKey);
  
    // Config validation
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not found');

    // Create bot
    const bot = createBot(token);
    setupBot(bot);

    // Fetch and store bot info
    const botInfo = await bot.telegram.getMe();
    setBotInfo(botInfo);
    console.log(`✅ Bot authenticated: @${botInfo.username} (${botInfo.first_name})\n`);

    // Set bot commands
    await bot.telegram.setMyCommands([
      { command: 'menu', description: 'Open main menu' },
      { command: 'help', description: 'Get help' },
    ]);
    console.log('[Bot] ✅ Command menu set');

    // Start services
    await startExchangeInfoService();
    await startPriceCacheService();
    
    return bot;

  } catch (error) {
    console.error('❌ Failed to init bot services:', error);
    await disconnectRedis();
    await disconnectPostgres();
    throw error;
  }
}

// Original/Legacy Entry Point (Modified to use initBotServices)
export async function startBotApp() {
  try {
    const bot = await initBotServices();
    
    // Get config
    let webhookUrl = process.env.WEBHOOK_URL;

    // Dynamic ngrok detection if no URL set
    if (!webhookUrl || webhookUrl === 'polling') {
      const ngrokUrl = await getNgrokUrl();
      if (ngrokUrl) {
        console.log(`[Ngrok] 📡 Detected dynamic ngrok URL: ${ngrokUrl}`);
        webhookUrl = ngrokUrl;
        process.env.WEBHOOK_URL = ngrokUrl;
      }
    }

    const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
    const port = parseInt(process.env.PORT || '3000');

    // Create Express app
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        instance: process.env.INSTANCE_ID || 'unknown',
        uptime: process.uptime(),
      });
    });

    // Serving mini-app static files
    app.use('/mini-app', express.static('webapp'));

    // WEBHOOK-ONLY MODE
    if (!webhookUrl || webhookUrl === 'polling') {
      throw new Error('WEBHOOK_URL is required. Polling mode disabled for scalability. Please set WEBHOOK_URL in .env');
    }

    // Webhook secret validation middleware
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('WEBHOOK_SECRET not found (required for webhook mode)');
    }

    // Webhook endpoint
    app.post(webhookPath, async (req: Request, res: Response) => {
      const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (receivedSecret !== webhookSecret) {
        console.warn('[Webhook] ❌ Invalid secret token received');
        return res.status(403).json({ error: 'Forbidden' });
      }
      logWebhook(req.body).catch(() => {});
      await bot.handleUpdate(req.body, res);
    });

    // Set webhook
    await bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`, {
      secret_token: webhookSecret,
    });
    
    console.log(`🚀 Bot is running in WEBHOOK mode`);
    console.log(`📡 Webhook URL: ${webhookUrl}${webhookPath}`);

    // Start server
    app.listen(port, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🏥 Health check: http://localhost:${port}/health`);
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

// Note: main() call removed to allow importing
