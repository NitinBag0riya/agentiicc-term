/**
 * Main Bot Setup - DFD Based Implementation
 * Module 1: Authentication & Core Bot Structure
 */

import { Telegraf, Scenes, Markup } from 'telegraf';
import type { BotContext } from './types/context';
import { createSessionMiddleware } from './middleware/session';
import { createReferralMiddleware, needsReferralCode, validateReferralCode, createUserWithReferral } from './middleware/referral';
import { linkScene } from './scenes/link.scene';
import { unlinkScene } from './scenes/unlink.scene';
import { setBotInfo } from './utils/botInfo';
import { getOrCreateUser } from '../db/users';
import { getPostgres } from '../db/postgres';

/**
 * Welcome message for unlinked users (DFD: welcome screen)
 */
const WELCOME_MESSAGE_UNLINKED =
  `👋 **Welcome to AgentiFi Trading Bot**

_Your Unified Trading Terminal_

**Choose How to Connect:**

🔗 **API Key** - Connect via exchange API credentials
🔐 **WalletConnect** - One-click wallet connection (Coming Soon)

🔒 _Your credentials are encrypted and stored securely_

**Available Commands:**
/menu - Open main menu
/help - Get help`;

/**
 * Generate inline keyboard for unlinked users
 */
function getUnlinkedKeyboard(exchange: string = 'aster') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔗 Link via API Key', 'start_link')],
    [Markup.button.callback('❓ Help', 'help')],
  ]);
}

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

  // Middleware: Scene manager
  const stage = new Scenes.Stage<BotContext>([
    linkScene,
    unlinkScene,
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
 * Show menu based on login status
 */
export async function showMenu(ctx: BotContext) {
  if (ctx.session.isLinked) {
    // Show Citadel overview (will be implemented in Module 2)
    await ctx.reply(
      `📊 **Citadel Overview**

Exchange: ${ctx.session.activeExchange?.toUpperCase()}

_Trading interface coming in Module 2_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'refresh_overview')],
          [Markup.button.callback('⚙️ Settings', 'settings')],
        ])
      }
    );
  } else {
    await ctx.reply(WELCOME_MESSAGE_UNLINKED, {
      parse_mode: 'Markdown',
      ...getUnlinkedKeyboard(ctx.session.activeExchange),
    });
  }
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
  bot.action('start_link', async ctx => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('link');
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

  // Settings (placeholder for Module 3)
  bot.action('settings', async ctx => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `⚙️ **Settings**

_Settings menu coming in Module 3_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  console.log('[Bot] ✅ Commands setup complete');
}
