import 'dotenv/config';
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import type { BotContext } from './bot/types/context';
import { linkScene } from './bot/scenes/link.scene';
import { unlinkScene } from './bot/scenes/unlink.scene';
import { getOrCreateUser, getApiCredentials } from './db/users';
import { connectPostgres, initSchema } from './db/postgres';
import { createApiServer } from './api/server';
import { AdapterFactory } from './adapters/factory';

/**
 * Show account details for the user's linked exchange
 */
async function showAccountDetails(ctx: BotContext) {
  const userId = ctx.session.userId;
  const exchangeId = ctx.session.activeExchange;

  if (!userId || !exchangeId) {
    await ctx.reply('❌ Please link an exchange first using /link');
    return;
  }

  try {
    await ctx.reply('⏳ Fetching account details...');

    // Create adapter for user's exchange
    const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
    
    // Get account info
    const accountInfo = await adapter.getAccount();

    // Format the message
    const exchangeName = exchangeId === 'aster' ? 'Aster DEX' : 'Hyperliquid';
    const emoji = exchangeId === 'aster' ? '🌟' : '⚡';
    
    let message = `${emoji} **${exchangeName}**\n\n`;
    message += `💰 Total: $${parseFloat(accountInfo.totalBalance).toFixed(2)}\n`;
    message += `💵 Available: $${parseFloat(accountInfo.availableBalance).toFixed(2)}\n\n`;

    if (accountInfo.positions && accountInfo.positions.length > 0) {
      const posCount = accountInfo.positions.length;
      const displayCount = Math.min(posCount, 5); // Limit to 5 positions
      message += `📊 **Positions:** ${posCount}\n\n`;
      
      accountInfo.positions.slice(0, displayCount).forEach((pos, index) => {
        const pnl = parseFloat(pos.unrealizedPnl);
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        const sideEmoji = pos.side === 'LONG' ? '📈' : '📉';
        
        message += `${sideEmoji} **${pos.symbol}** ${pos.side}\n`;
        message += `Size: ${pos.size} | PnL: ${pnlEmoji} $${pnl.toFixed(2)}\n\n`;
      });
      
      if (posCount > displayCount) {
        message += `_...and ${posCount - displayCount} more positions_\n\n`;
      }
    } else {
      message += `📊 **Positions:** None\n\n`;
    }

    message += `🕐 ${new Date().toLocaleTimeString()}`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'view_account')],
        [Markup.button.callback('« Back to Menu', 'menu')]
      ])
    });

  } catch (error: any) {
    await ctx.reply(
      `❌ **Failed to fetch account details**\n\n` +
      `Error: ${error.message}\n\n` +
      `Make sure your API credentials are valid.`,
      { parse_mode: 'Markdown' }
    );
  }
}

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
  const stage = new Scenes.Stage<BotContext>([linkScene, unlinkScene]);

  // Middleware
  bot.use(session());
  bot.use(stage.middleware());

  // Command: /start
  bot.start(async (ctx) => {
    const user = await getOrCreateUser(ctx.from.id, ctx.from.username);
    ctx.session.userId = user.id;

    // Check if user has linked credentials
    const asterCreds = await getApiCredentials(user.id, 'aster');
    const hlCreds = await getApiCredentials(user.id, 'hyperliquid');

    if (asterCreds) {
      ctx.session.activeExchange = 'aster';
      ctx.session.isLinked = true;
    } else if (hlCreds) {
      ctx.session.activeExchange = 'hyperliquid';
      ctx.session.isLinked = true;
    }

    const welcomeMsg =
      '👋 **Welcome to AgentiFi Dev!**\n\n' +
      'This is a minimal version for testing the /link feature.\n\n' +
      (ctx.session.isLinked
        ? `✅ Linked: ${ctx.session.activeExchange}\n\nUse /account to view your account.`
        : '🔗 Use /link to connect your exchange.');

    const buttons = [];
    
    if (ctx.session.isLinked) {
      buttons.push([Markup.button.callback('📊 View Account', 'view_account')]);
      buttons.push([Markup.button.callback('🔓 Unlink', 'start_unlink')]);
    } else {
      buttons.push([Markup.button.callback('🔗 Link Exchange', 'start_link')]);
    }

    await ctx.reply(welcomeMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  });

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
    await showAccountDetails(ctx);
  });
  
  bot.action('view_account', async (ctx) => {
    await ctx.answerCbQuery();
    await showAccountDetails(ctx);
  });

  // Command: /menu
  bot.command('menu', async (ctx) => {
    const isLinked = ctx.session.isLinked;
    const exchange = ctx.session.activeExchange;

    const menuMsg = isLinked
      ? `📋 **Menu**\n\nActive: ${exchange}\n\nManage your connection:`
      : '📋 **Menu**\n\nNo exchange linked.';

    const menuButtons = [];
    
    if (isLinked) {
      menuButtons.push([Markup.button.callback('📊 View Account', 'view_account')]);
      menuButtons.push([Markup.button.callback('🔓 Unlink', 'start_unlink')]);
    } else {
      menuButtons.push([Markup.button.callback('🔗 Link Exchange', 'start_link')]);
    }

    await ctx.reply(menuMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(menuButtons)
    });
  });

  // Menu action handler (for button callbacks)
  bot.action('menu', async (ctx) => {
    await ctx.answerCbQuery();
    
    const isLinked = ctx.session.isLinked;
    const exchange = ctx.session.activeExchange;

    const menuMsg = isLinked
      ? `📋 **Menu**\\n\\nActive: ${exchange}\\n\\nManage your connection:`
      : '📋 **Menu**\\n\\nNo exchange linked.';

    const menuButtons = [];
    
    if (isLinked) {
      menuButtons.push([Markup.button.callback('📊 View Account', 'view_account')]);
      menuButtons.push([Markup.button.callback('🔓 Unlink', 'start_unlink')]);
    } else {
      menuButtons.push([Markup.button.callback('🔗 Link Exchange', 'start_link')]);
    }

    await ctx.editMessageText(menuMsg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(menuButtons)
    });
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
