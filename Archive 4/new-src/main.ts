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
import { setBotInfo } from './utils/botInfo';
import tgmaRouter from './tgma';

dotenv.config();

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
    const webhookUrl = process.env.WEBHOOK_URL;
    const webhookPath = process.env.WEBHOOK_PATH || '/webhook';
    const port = parseInt(process.env.PORT || '3000');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found');
    }

    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL not found (required for webhook mode)');
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

    // Health check endpoint (for load balancer)
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        instance: process.env.INSTANCE_ID || 'unknown',
        uptime: process.uptime(),
      });
    });

    // Mount TGMA router (Telegram Mini App API)
    app.use('/tgma', tgmaRouter);

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

    // Start server
    app.listen(port, '0.0.0.0', () => {
      console.log('✅ Bot started successfully!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Bot is running in WEBHOOK mode');
      console.log(`📡 Webhook URL: ${webhookUrl}${webhookPath}`);
      console.log(`🏥 Health check: http://localhost:${port}/health`);
      console.log(`🔢 Instance ID: ${process.env.INSTANCE_ID || 'unknown'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Safe to run multiple instances!\n');
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
