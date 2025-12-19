import 'dotenv/config';
import { Telegraf, Scenes, session } from 'telegraf';
import type { BotContext } from './bot/types/context';
import { linkScene } from './bot/scenes/link.scene';
import { unlinkScene } from './bot/scenes/unlink.scene';
import { citadelScene } from './bot/scenes/citadel.scene';
import { tradingScene } from './bot/scenes/trading.scene';
import { settingsScene } from './bot/scenes/settings.scene';
import { getOrCreateUser } from './db/users';
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
  
  // Register Scenes
  const stage = new Scenes.Stage<BotContext>([
      linkScene, 
      unlinkScene,
      citadelScene,
      tradingScene,
      settingsScene
  ]);

  // Middleware
  bot.use(session());
  
  // DEBUG: Log all updates
  bot.use(async (ctx, next) => {
    console.log(`📩 Incoming update: ${ctx.updateType}`, JSON.stringify(ctx.update, null, 2));
    await next();
  });

  bot.use(stage.middleware());

  // Command: /start
  bot.start(async (ctx) => {
    console.log('🏁 DATA TRACE: /start command received', ctx.from.id);
    try {
        console.log('DATA TRACE: Fetching user...');
        const user = await getOrCreateUser(ctx.from.id, ctx.from.username);
        console.log('DATA TRACE: User fetched:', user.id);
        
        ctx.session.userId = user.id;
        console.log('DATA TRACE: Session userId set. Entering citadel...');

        // Enter Citadel (which redirects to link if needed)
        await ctx.scene.enter('citadel');
        console.log('DATA TRACE: Entered citadel scene.');
        
    } catch (error) {
        console.error('❌ Start Error:', error);
        await ctx.reply('❌ System Error during initialization.');
    }
  });

  // Global Commands
  bot.command('menu', (ctx) => ctx.scene.enter('citadel'));
  bot.command('trade', (ctx) => ctx.scene.enter('trading'));
  bot.command('settings', (ctx) => ctx.scene.enter('settings'));
  bot.command('link', (ctx) => ctx.scene.enter('link'));

  // Launch
  console.log('🚀 AgentiFi Dev Bot Started!');
  console.log('Press Ctrl+C to stop\n');
  
  // Enable graceful stop
  const stopBot = () => bot.stop();
  process.once('SIGINT', stopBot);
  process.once('SIGTERM', stopBot);

  await bot.launch();
}

// Start the bot
startBot().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
