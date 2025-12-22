/**
 * Main Bot Setup - DFD Based Implementation
 * Module 1: Authentication & Core Bot Structure
 */

import { Telegraf, Scenes, Markup } from 'telegraf';
import type { BotContext } from './types/context';
import { createSessionMiddleware } from './middleware/session';
import { createReferralMiddleware, needsReferralCode, validateReferralCode, createUserWithReferral } from './middleware/referral';

// Legacy scenes (kept for backwards compatibility)
import { linkScene } from './scenes/link.scene';
import { unlinkScene } from './scenes/unlink.scene';
import { citadelScene } from './scenes/citadel.scene';
import { tradingScene } from './scenes/trading.scene';
import { settingsScene } from './scenes/settings.scene';

// New DFD-based scenes (all 34 screens from dataflow-telegram.json)
import { allScenes } from './scenes';

import { setBotInfo } from './utils/botInfo';
import { getOrCreateUser } from '../db/users';
import { getPostgres } from '../db/postgres';
import { showMenu, getUnlinkedKeyboard, WELCOME_MESSAGE_UNLINKED } from './utils/menu';



/**
 * Create bot instance
 */
export function createBot(token: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);

  console.log('[Bot] Creating bot...');

  // Middleware: Session (Redis)
  bot.use(createSessionMiddleware());

  // Middleware: Referral enforcement
  bot.use(createReferralMiddleware());

  // Middleware: Global Command Breakout
  // Ensures /menu and /start always work even if user is stuck in a scene
  bot.use(async (ctx, next) => {
    if (ctx.message && 'text' in ctx.message) {
      const text = ctx.message.text;
      if (text === '/menu' || text === '/start' || text.startsWith('/start ')) {
        console.log(`[Bot] Global command detected: ${text}. Force clearing scene state.`);
        // Manually start fresh by clearing scene session
        if (ctx.session) {
          ctx.session.__scenes = undefined;
        }
      }
    }
    return next();
  });

  // Middleware: Scene manager - includes all DFD-based scenes plus legacy scenes
  const stage = new Scenes.Stage<BotContext>([
    // Legacy scenes (backwards compatibility)
    linkScene,
    unlinkScene,
    citadelScene,
    tradingScene,
    settingsScene,
    // New DFD-based scenes (34 screens from dataflow-telegram.json)
    ...allScenes,
  ]);
  bot.use(stage.middleware());

  // Error handling
  bot.catch((err, ctx) => {
    console.error('[Bot] Error:', err);
    ctx.reply('❌ An error occurred. Please try again.');
  });

  console.log('[Bot] ✅ Bot created');

  return bot;
}



/**
 * Setup bot commands and handlers
 */
export function setupBot(bot: Telegraf<BotContext>): void {
  console.log('[Bot] Setting up commands...');

  // ==================== /start Command ====================
  bot.command('start', async ctx => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || null;
    const db = getPostgres();

    // Check if there's a payload (referral code)
    const payload = ctx.message.text.split(' ')[1];

    // Check if user needs referral code
    const needsRef = await needsReferralCode(telegramId);

    if (needsRef) {
      // User needs referral code
      if (!payload) {
        await ctx.reply(
          `🔒 **Welcome to AgentiFi!**

This bot requires a **referral code** to access.

**How to get started:**
1️⃣ Get a referral code from an existing user
2️⃣ Send \`/start YOUR_CODE\` to activate access

💡 Example: \`/start ABC12XYZ\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❓ Help', 'help')],
            ]),
          }
        );
        return;
      }

      // Validate referral code
      const validation = await validateReferralCode(payload);

      if (!validation.valid) {
        await ctx.reply(
          `❌ **Invalid Referral Code**

The code \`${payload}\` is not valid.

Try again with: \`/start VALID_CODE\``,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Create user with referral
      const result = await createUserWithReferral(telegramId, username, payload);

      if (!result.success) {
        await ctx.reply('❌ Error creating account. Please try again.');
        return;
      }

      const user = await getOrCreateUser(telegramId, username || undefined);
      ctx.session.userId = user.id;
      ctx.session.telegramId = telegramId;
      ctx.session.username = username || undefined;

      await ctx.reply(
        `✅ **Welcome to AgentiFi!**

You've successfully joined using ${validation.referrerUsername}'s referral code!

🎁 **Your Referral Code:** \`${result.ownReferralCode}\`

Share your code to invite friends!

**Next Steps:**
1️⃣ Link your trading account (/menu)
2️⃣ Start trading!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Get Started', 'menu')],
          ]),
        }
      );
      return;
    }

    // User is verified - show normal flow
    const user = await getOrCreateUser(telegramId, username || undefined);
    ctx.session.userId = user.id;
    ctx.session.telegramId = telegramId;
    ctx.session.username = username || undefined;

    await showMenu(ctx);
  });

  // ==================== /menu Command ====================
  bot.command('menu', async ctx => {
    console.log('[Debug] /menu command received');
    ctx.session.waitingForInput = undefined;
    await showMenu(ctx);
  });

  // ==================== /link Command ====================
  bot.command('link', ctx => ctx.scene.enter('link'));

  // ==================== /unlink Command ====================
  bot.command('unlink', ctx => ctx.scene.enter('unlink'));

  // ==================== /help Command ====================
  bot.command('help', async ctx => {
    const helpMessage =
      `📚 **AgentiFi Trading Bot Help**

**🔗 Getting Started:**
1️⃣ Use /menu and click "Link via API Key"
2️⃣ Enter your exchange API credentials
3️⃣ Start trading!

**🎯 Features:**
• Market & Limit Orders
• Take Profit & Stop Loss
• Futures Trading
• Position Management

**🔧 Commands:**
/menu - Open main menu
/trade - Quick trade: /trade btc long 50
/referral - Get your referral code
/help - Show this help`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  });

  // ==================== /referral Command ====================
  bot.command('referral', async ctx => {
    const telegramId = ctx.from.id;
    const botInfo = await ctx.telegram.getMe();
    
    try {
      const user = await getOrCreateUser(telegramId, ctx.from.username || undefined);
      
      if (user && user.referral_code) {
        const shareLink = `https://t.me/${botInfo.username}?start=${user.referral_code}`;
        
        await ctx.reply(
          `🎁 **Your Referral Code**

📋 Code: \`${user.referral_code}\`

🔗 Share Link:
${shareLink}

💡 Share this link with friends to invite them!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply('❌ Referral code not found. Please contact support.');
      }
    } catch (error) {
      console.error('Error fetching referral code:', error);
      await ctx.reply('❌ Error fetching referral code. Please try again.');
    }
  });

  // ==================== /trade Quick Command ====================
  // Format: /trade [exchange] symbol side amount
  // Examples: /trade aster btc long 20
  //           /trade btc long 20 (uses active exchange)
  //           /trade sol short 50
  bot.command('trade', async ctx => {
    const telegramId = ctx.from.id;
    const args = ctx.message.text.split(/\s+/).slice(1); // Remove /trade
    
    if (args.length < 3) {
      await ctx.reply(
        `📖 **Quick Trade Usage**

\`/trade [exchange] symbol side amount\`

**Examples:**
• \`/trade aster btc long 20\` - Long BTC $20 on Aster
• \`/trade btc long 50\` - Long BTC $50 on active exchange
• \`/trade sol short 100\` - Short SOL $100

**Parameters:**
• exchange: \`aster\` or \`hyperliquid\` (optional)
• symbol: \`btc\`, \`eth\`, \`sol\`, etc.
• side: \`long\` or \`short\`
• amount: USD value (e.g. \`50\`)

**Uses your settings:**
• Leverage: ${ctx.session.leverage || 10}x
• Order Type: ${ctx.session.orderType || 'Market'}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      const user = await getOrCreateUser(telegramId, ctx.from.username || undefined);
      
      // Parse arguments
      let exchange: string;
      let symbolArg: string;
      let sideArg: string;
      let amountArg: string;

      // Check if first arg is exchange
      if (['aster', 'hyperliquid', 'hl'].includes(args[0].toLowerCase())) {
        exchange = args[0].toLowerCase() === 'hl' ? 'hyperliquid' : args[0].toLowerCase();
        symbolArg = args[1];
        sideArg = args[2];
        amountArg = args[3];
      } else {
        // Use active exchange from session
        exchange = ctx.session.activeExchange || 'aster';
        symbolArg = args[0];
        sideArg = args[1];
        amountArg = args[2];
      }

      // Validate side
      const side = sideArg.toLowerCase();
      if (!['long', 'short', 'buy', 'sell'].includes(side)) {
        await ctx.reply('❌ Invalid side. Use `long` or `short`', { parse_mode: 'Markdown' });
        return;
      }

      // Normalize symbol
      let symbol = symbolArg.toUpperCase();
      if (!symbol.includes('USDT') && !symbol.includes('USD')) {
        symbol = `${symbol}USDT`;
      }

      // Parse amount
      const amount = parseFloat(amountArg);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Enter a positive number.');
        return;
      }

      // Get settings from session
      const leverage = ctx.session.leverage || 10;
      const orderType = ctx.session.orderType || 'Market';

      // Send "processing" message
      const processingMsg = await ctx.reply(
        `⏳ Executing: **${side.toUpperCase()} ${symbol}** $${amount} @ ${leverage}x on ${exchange.toUpperCase()}...`,
        { parse_mode: 'Markdown' }
      );

      // Import UniversalApiService
      const { UniversalApiService } = require('./services/universal-api.service');

      // Get price for quantity calculation
      const ticker = await UniversalApiService.getMarketPrice(exchange, symbol);
      const price = parseFloat(ticker.price);

      // Calculate quantity
      const notional = amount * leverage;
      const assetInfo = await UniversalApiService.getAsset(exchange, symbol);
      const stepSize = parseFloat(assetInfo?.stepSize || '0.001');
      const rawQuantity = notional / price;
      const quantity = Math.floor(rawQuantity / stepSize) * stepSize;

      if (quantity <= 0) {
        await ctx.reply(`❌ Order too small. Minimum ~$${(stepSize * price).toFixed(2)}`);
        return;
      }

      // Execute order
      const orderSide = ['long', 'buy'].includes(side) ? 'BUY' : 'SELL';
      const result = await UniversalApiService.placeOrder(user.id, exchange, {
        symbol,
        side: orderSide,
        type: orderType.toUpperCase(),
        quantity: quantity.toFixed(6),
        leverage,
      });

      if (result && result.orderId) {
        await ctx.reply(
          `✅ **Order Executed!**

📊 ${side.toUpperCase()} ${symbol}
💰 Amount: $${amount}
📦 Qty: ${quantity.toFixed(6)}
⚡ Leverage: ${leverage}x
🏦 Exchange: ${exchange.toUpperCase()}
🆔 Order: \`${result.orderId}\``,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply('❌ Order failed - no order ID returned');
      }

    } catch (error: any) {
      console.error('Quick trade error:', error);
      await ctx.reply(`❌ Trade failed: ${error.message}`);
    }
  });

  // ==================== Button Handlers ====================

  // Exchange Selection (DFD: welcome -> exchange_selection_aster/hyperliquid)
  bot.action('select_exchange_aster', async ctx => {
    await ctx.answerCbQuery();
    ctx.session.activeExchange = 'aster';
    return ctx.scene.enter('exchange_selection_aster');
  });

  bot.action('select_exchange_hyperliquid', async ctx => {
    await ctx.answerCbQuery();
    ctx.session.activeExchange = 'hyperliquid';
    return ctx.scene.enter('exchange_selection_hyperliquid');
  });

  // Start link flow (legacy)
  bot.action(['start_link', 'link_exchange'], async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('link');
  });

  // Enter Citadel (DFD: universal_citadel)
  bot.action('enter_citadel', async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('universal_citadel');
  });

  // Help
  bot.action('help', async ctx => {
    await ctx.answerCbQuery();
    const helpMessage =
      `📚 **AgentiFi Trading Bot Help**

**🔗 Getting Started:**
1️⃣ Use /menu and click "Link via API Key"
2️⃣ Enter your exchange API credentials
3️⃣ Start trading!

**🔧 Commands:**
/menu - Open main menu
/help - Show this help`;

    await ctx.editMessageText(helpMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
    });
  });

  // Menu action
  bot.action('menu', async ctx => {
    await ctx.answerCbQuery();
    ctx.session.waitingForInput = undefined;
    await showMenu(ctx);
  });

  // Settings
  bot.action('settings', async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('settings');
  });

  console.log('[Bot] ✅ Commands setup complete');
}
