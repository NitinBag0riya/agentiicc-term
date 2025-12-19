/**
 * Referral Middleware
 *
 * Blocks ALL bot access until user provides valid referral code
 */

import { Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { getPostgres } from '../db/postgres';
import { needsReferralCode } from '../db/referrals';

/**
 * Commands and actions that are ALWAYS allowed (even for unverified users)
 */
const ALLOWED_COMMANDS = [
  '/start',
  '/help',
];

const ALLOWED_ACTIONS = [
  'help',
  'submit_referral', // Allow submitting referral code
];

/**
 * Middleware to enforce referral code requirement
 *
 * Blocks all commands/actions except:
 * - /start (to enter referral code)
 * - /help (to show help)
 * - submit_referral action (to submit code)
 */
export function createReferralMiddleware() {
  return async (ctx: BotContext, next: () => Promise<void>) => {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      // No user ID - skip this middleware
      return next();
    }

    try {
      const db = getPostgres();
      const needsRef = await needsReferralCode(db, telegramId);

      if (!needsRef) {
        // User is verified, allow access
        return next();
      }

      // User needs referral code - check if current action is allowed
      const isCommand = ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/');
      const commandText = isCommand ? ctx.message!.text : null;

      // Allow /start and /help commands
      if (commandText && ALLOWED_COMMANDS.some(cmd => commandText.startsWith(cmd))) {
        return next();
      }

      // Allow specific callback actions
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const action = ctx.callbackQuery.data;
        if (ALLOWED_ACTIONS.some(allowed => action?.startsWith(allowed))) {
          return next();
        }
      }

      // Block all other access - show referral code prompt
      await showReferralCodePrompt(ctx);
    } catch (error) {
      console.error('[Referral Middleware] Error:', error);
      // On error, allow access (fail open for better UX)
      return next();
    }
  };
}

/**
 * Show referral code requirement message
 */
async function showReferralCodePrompt(ctx: BotContext) {
  const message =
    '🔒 **Access Restricted**\n\n' +
    'This bot requires a **referral code** to access.\n\n' +
    '**How to get started:**\n' +
    '1️⃣ Get a referral code from an existing user\n' +
    '2️⃣ Send `/start YOUR_CODE` to activate access\n\n' +
    '💡 Example: `/start ABC12XYZ`\n\n' +
    '_Don\'t have a code? Ask a friend who uses this bot!_';

  // Try to answer callback query if this is from a button
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCbQuery('⚠️ Referral code required');
    } catch (e) {
      // Ignore
    }
  }

  try {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❓ Help', 'help')],
      ]),
    });
  } catch (error) {
    console.error('[Referral] Error showing prompt:', error);
  }
}
