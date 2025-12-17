import 'dotenv/config';
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import type { BotContext } from './bot/types/context';
import { linkScene } from './bot/scenes/link.scene';
import { unlinkScene } from './bot/scenes/unlink.scene';
import { spotBuyScene } from './bot/scenes/spot-buy.scene';
import { tpslScene } from './bot/scenes/tpsl.scene';
import { startComposer } from './bot/composers/start.composer';
import { overviewComposer, showOverview } from './bot/composers/overview.composer'
import { positionComposer } from './bot/composers/position.composer';
import { tradeComposer } from './bot/composers/trade.composer';
import { searchComposer } from './bot/composers/search.composer';
import { leverageWizard } from './bot/scenes/leverage.scene';
import { marginWizard } from './bot/scenes/margin.scene';
import { marketOrderScene } from './bot/scenes/market-order.scene';
import { ApiClient } from './services/apiClient';
// DB connection still needed for Server but maybe not for Bot if purely API?
// The file starts the server AND bot, so yes, needed.
import { connectPostgres, initSchema } from './db/postgres';
import { createApiServer } from './api/server';

async function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not found in environment variables');
  }

  // 1. Initialize Database
  console.log('🔌 Connecting to PostgreSQL...');
  await connectPostgres();
  await initSchema();
  console.log('✅ Database ready');

  // 2. Start API Server
  console.log('🚀 Starting API Server...');
  createApiServer(3000);

  // 3. Setup Bot
  const bot = new Telegraf<BotContext>(token);
  const stage = new Scenes.Stage<BotContext>([
    linkScene,
    unlinkScene,
    spotBuyScene,
    tpslScene,
    leverageWizard,
    marginWizard,
    marketOrderScene
  ]);

  // Middleware
  bot.use(session());
  bot.use(stage.middleware());
  bot.use(startComposer);
  bot.use(overviewComposer);
  bot.use(positionComposer);
  bot.use(tradeComposer);
  bot.use(searchComposer);

  // Command: /link
  bot.command('link', (ctx) => ctx.scene.enter('link'));
  bot.action('start_link', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('link');
  });

  // Command: /unlink
  bot.command('unlink', (ctx) => ctx.scene.enter('unlink'));
  bot.action('start_unlink', (ctx) => {
    ctx.answerCbQuery();
    return ctx.scene.enter('unlink');
  });

  // Command: /account - View account details
  bot.command('account', async (ctx) => {
    await showOverview(ctx);
  });

  // Command: /menu -> Redirects to start (Command Citadel)
  bot.command('menu', async (ctx) => {
    await ctx.reply('Use /start for the main menu');
  });

  // Trade Action
  bot.action('trade', async (ctx) => {
    await ctx.answerCbQuery();
    // Defaulting to ASTERUSDT for now as per legacy behavior
    // In future, could ask which asset
    return ctx.scene.enter('spot-buy', { symbol: 'ASTERUSDT' });
  });

  // Trade Action
  bot.action('trade', async (ctx) => {
    await ctx.answerCbQuery();
    // Defaulting to ASTERUSDT for now as per legacy behavior
    // In future, could ask which asset
    return ctx.scene.enter('spot-buy', { symbol: 'ASTERUSDT' });
  });

  // Launch
  console.log('🚀 AgentiFi Dev Bot Started!');
  console.log('Press Ctrl+C to stop\n');
  await bot.launch();

  // Graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Start the bot
startBot().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
