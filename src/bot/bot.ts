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
/help - Show this help`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  });

  // ==================== Button Handlers ====================

  // Start link flow
  bot.action(['start_link', 'link_exchange'], async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('link');
  });

  // Enter Citadel
  bot.action('enter_citadel', async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('citadel');
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
