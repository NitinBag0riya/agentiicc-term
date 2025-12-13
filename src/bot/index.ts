/**
 * Telegram Bot Entry Point
 * 
 * Webhook-based bot for scalability
 */

import { Telegraf, session, Scenes } from 'telegraf';
import type { BotContext } from './types/context';
import { BOT_CONFIG } from './config';
import { linkScene } from './scenes/link.scene';
import { unlinkScene } from './scenes/unlink.scene';
import { mainMenuComposer } from './composers/main-menu.composer';
import { connectPostgres, initSchema } from '../db/postgres';

export async function createBot() {
  console.log('🤖 Initializing Telegram Bot...');

  // Validate configuration
  if (!BOT_CONFIG.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN not set in environment');
  }

  // Initialize database
  await connectPostgres();
  await initSchema();

  // Create bot
  const bot = new Telegraf<BotContext>(BOT_CONFIG.botToken);

  // Session middleware (in-memory for simplicity)
  bot.use(session());

  // Create scene stage
  const stage = new Scenes.Stage<BotContext>([
    linkScene,
    unlinkScene,
  ]);

  bot.use(stage.middleware());

  // Register composers
  bot.use(mainMenuComposer);

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`[Bot] Error for ${ctx.updateType}:`, err);
    ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
  });

  console.log('✅ Bot initialized successfully');

  return bot;
}

export async function startBot() {
  const bot = await createBot();

  if (BOT_CONFIG.webhookUrl) {
    // Webhook mode (production)
    console.log('🌐 Starting bot in webhook mode...');
    
    const webhookUrl = `${BOT_CONFIG.webhookUrl}${BOT_CONFIG.webhookPath}`;
    
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook set to: ${webhookUrl}`);

    // Start webhook server
    await bot.launch({
      webhook: {
        domain: BOT_CONFIG.webhookUrl,
        port: BOT_CONFIG.port,
        hookPath: BOT_CONFIG.webhookPath,
      },
    });

    console.log(`🚀 Bot is running in webhook mode on port ${BOT_CONFIG.port}`);
  } else {
    // Polling mode (development)
    console.log('🔄 Starting bot in polling mode...');
    await bot.launch();
    console.log('🚀 Bot is running in polling mode');
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}

// Start bot if run directly
if (import.meta.main) {
  startBot().catch((error) => {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  });
}
