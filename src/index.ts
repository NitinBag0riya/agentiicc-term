/**
 * Main Entry Point - Webhook Mode
 * Module 1: Authentication & Core Bot
 */

import dotenv from 'dotenv';
import { createBot, setupBot } from './bot/bot';
import { connectRedis, disconnectRedis } from './bot/middleware/session';
import { connectPostgres, disconnectPostgres, initSchema } from './db/postgres';
import { setBotInfo } from './bot/utils/botInfo';
import { createApiServer } from './api/server';

dotenv.config();

async function startApp() {
  try {
    console.log('🚀 Starting AgentiFi Trading Bot...\n');

    // 1. Connect to databases
    console.log('[DB] Connecting to PostgreSQL...');
    await connectPostgres();
    await initSchema();
    console.log('[DB] ✅ PostgreSQL ready');

    console.log('[DB] Connecting to Redis...');
    connectRedis(process.env.REDIS_URL);
    console.log('[DB] ✅ Redis ready');

    // 2. Create and setup bot
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
    }

    const bot = createBot(token);
    setupBot(bot);

    // 3. Fetch and store bot info
    const botInfo = await bot.telegram.getMe();
    setBotInfo(botInfo);
    console.log(`[Bot] ✅ Authenticated: @${botInfo.username} (${botInfo.first_name})`);

    // 4. Set bot commands
    await bot.telegram.setMyCommands([
      { command: 'menu', description: 'Open main menu' },
      { command: 'help', description: 'Get help' },
    ]);
    console.log('[Bot] ✅ Command menu set');

    // 5. Start API server (includes webhook handling)
    const port = parseInt(process.env.PORT || '3000');
    console.log(`[API] Starting server on port ${port}...`);
    
    const app = createApiServer(port, bot);
    
    app.listen(port, async () => {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ AgentiFi Bot + API Server running`);
      console.log(`📡 Port: ${port}`);
      console.log(`🤖 Bot: @${botInfo.username}`);
      
      // Set webhook if WEBHOOK_URL is provided
      const webhookUrl = process.env.WEBHOOK_URL;
      if (webhookUrl && webhookUrl.trim() !== '') {
        try {
          await bot.telegram.setWebhook(`${webhookUrl}/webhook`, {
            secret_token: process.env.WEBHOOK_SECRET,
          });
          console.log(`🔗 Webhook set: ${webhookUrl}/webhook`);
        } catch (error: any) {
          console.error('⚠️  Failed to set webhook:', error.message || error);
          console.error('   Make sure WEBHOOK_URL is a valid HTTPS URL');
          console.error('   Current value:', webhookUrl);
        }
      } else {
        console.log('⚠️  WEBHOOK_URL not set - bot will not receive updates');
        console.log('   To enable webhook, set WEBHOOK_URL in .env to your HTTPS domain');
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    // 6. Graceful shutdown
    const shutdown = async () => {
      console.log('\n📡 Shutting down gracefully...');
      try {
        // Only stop bot if webhook was set
        if (process.env.WEBHOOK_URL) {
          await bot.telegram.deleteWebhook();
          console.log('✅ Webhook deleted');
        }
      } catch (error) {
        console.error('⚠️  Error during shutdown:', error);
      }
      await disconnectRedis();
      await disconnectPostgres();
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

  } catch (error) {
    console.error('❌ Failed to start app:', error);
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

// Start the app
startApp();
