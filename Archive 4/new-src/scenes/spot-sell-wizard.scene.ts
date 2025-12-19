/**
 * Spot Sell Wizard Scene
 *
 * Simple flow for selling spot assets for USDT
 * No leverage, no margin - just 1:1 trading
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { parseAmount } from '../utils/inputParser';
import { showConfirmation } from '../utils/confirmDialog';
import { getRedis } from '../db/redis';
import { getPostgres } from '../db/postgres';
import { getAsterClientForUser } from '../aster/helpers';
import type { AsterWriteOp } from '../aster/writeOps';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

// ========== Scene State Type ==========

interface SpotSellWizardState {
  asset: string; // e.g., "ASTER"
  symbol: string; // e.g., "ASTERUSDT"
  retryCount: number;
  prefilledAmount?: string; // For percentage buttons (25%, 50%, etc.)
}

// ========== Spot Sell Wizard ==========

export const spotSellWizard = new Scenes.WizardScene<BotContext>(
  'spot-sell-wizard',

  // Step 1: Ask for amount (or use prefilled)
  async (ctx) => {
    const state = ctx.wizard.state as SpotSellWizardState;

    // Initialize retry count
    if (state.retryCount === undefined) {
      state.retryCount = 0;
    }

    if (!state.asset || !state.symbol) {
      await ctx.reply('❌ Invalid wizard state. Please try again.');
      await ctx.reply('Returning to menu...', {
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
      });
      return ctx.scene.leave();
    }

    // Check for prefilled amount (from percentage buttons)
    if (state.prefilledAmount) {
      // Skip to step 2 with prefilled amount
      ctx.wizard.selectStep(1);
      return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    }

    // Clean old button messages before sending wizard prompt
    await cleanupButtonMessages(ctx);

    const sentMessage = await ctx.reply(
      `💰 **Sell ${state.asset}** (Spot)\n\n` +
      `Enter amount to sell:\n` +
      `• 25% (of ${state.asset} balance)\n` +
      `• 50% (of ${state.asset} balance)\n` +
      `• 100 ${state.asset}\n\n` +
      `Type your amount:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_wizard')]]),
      }
    );

    // Track wizard message for cleanup
    trackButtonMessage(ctx, sentMessage.message_id);

    return ctx.wizard.next();
  },

  // Step 2: Process amount and confirm
  async (ctx) => {
    const state = ctx.wizard.state as SpotSellWizardState;

    // For prefilled amounts, skip verification
    const isPrefilled = state.prefilledAmount !== undefined;

    // Verify this is a text message (unless prefilled)
    if (!isPrefilled) {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send a text message with your amount.');
        return; // Stay in same step
      }
    }

    const input = isPrefilled ? state.prefilledAmount! : (ctx.message as any).text;

    // Check for cancel
    if (input.toLowerCase() === 'cancel' || input === '/cancel') {
      await ctx.reply('❌ Sale cancelled.');
      await ctx.reply('Returning to menu...', {
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
      });
      return ctx.scene.leave();
    }

    // Parse amount
    const parsed = parseAmount(input, state.symbol);
    if (!parsed) {
      state.retryCount++;

      if (state.retryCount >= 2) {
        await ctx.reply(
          `⚠️ Too many invalid attempts. Returning to menu...\n\n` +
          `Valid formats:\n` +
          `• 25% → 25% of ${state.asset} balance\n` +
          `• 100 ${state.asset}\n` +
          `• 0.5 ${state.asset}`
        );
        await ctx.reply('Returning to menu...', {
          ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
        });
        return ctx.scene.leave();
      }

      await ctx.reply(
        `❌ Invalid amount format. Please try again.\n\n` +
        `Examples:\n` +
        `• 25% → 25% of ${state.asset} balance\n` +
        `• 100 ${state.asset}\n` +
        `• 0.5 ${state.asset}`
      );
      return; // Stay in same step
    }

    // Convert to params
    let quantityParams: any = {};
    if (parsed.type === 'PERCENT') {
      quantityParams.quantityAsPercent = parsed.value.toString();
    } else if (parsed.type === 'BASE_ASSET') {
      // Direct quantity in asset
      quantityParams.quantity = parsed.value.toString();
    } else if (parsed.type === 'USD') {
      // USD amount → need to convert to asset quantity
      quantityParams.quantityInUSD = parsed.value.toString();
    }

    // Build operation
    const operation: AsterWriteOp = {
      operation: 'CREATE_SPOT_ORDER',
      params: {
        symbol: state.symbol,
        side: 'SELL',
        type: 'MARKET',
        ...quantityParams,
      },
      metadata: {
        action: `Sell ${input} ${state.asset}`,
        baseAsset: state.asset,
        quoteAsset: 'USDT',
        originalInput: {
          type: parsed.type,
          value: parsed.value.toString(),
        },
      },
    };

    // Show confirmation
    const redis = getRedis();
    if (!ctx.session.userId) {
      await ctx.reply('❌ User not found. Please link your API keys first.');
      return ctx.scene.leave();
    }

    // Get client for calculations
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

    // Leave wizard (confirmation takes over)
    return ctx.scene.leave();
  }
);

// ========== Cancel Handler ====================
spotSellWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Sale cancelled.');
  await ctx.reply('Returning to menu...', {
    ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
  });
  return ctx.scene.leave();
});

// ========== Leave Handler ====================
spotSellWizard.leave(async (ctx) => {
  console.log('[SpotSellWizard] Exited');
  if (ctx.wizard) {
    ctx.wizard.state = {};
  }
});
