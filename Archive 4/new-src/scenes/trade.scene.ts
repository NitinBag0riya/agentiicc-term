/**
 * Trading Wizard Scenes
 *
 * Provides step-by-step guided flows for:
 * - MARKET orders (amount only)
 * - LIMIT orders (amount + price)
 *
 * Uses reply_to_message to ensure we capture the right input
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { parseAmount } from '../utils/inputParser';
import { showConfirmation } from '../utils/confirmDialog';
import { getRedis } from '../db/redis';
import { getPostgres } from '../db/postgres';
import { getAsterClientForUser } from '../aster/helpers';
import type { AsterWriteOp } from '../aster/writeOps';
import { showPositionManagement } from '../composers/futures-positions/interface';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

// ========== Scene State Types ==========

interface BaseWizardState {
  symbol: string;
  side: 'BUY' | 'SELL';
  leverage?: number;
  marginType?: string;
  reduceOnly?: boolean;
  retryCount: number;
  // Pre-filled amount (for fixed $50/$200 buttons)
  prefilledAmount?: string;
}

interface MarketOrderState extends BaseWizardState {}

interface LimitOrderState extends BaseWizardState {
  amount?: string; // Parsed amount from step 1
}

// ========== Helper Functions ==========

/**
 * Return to State 2 (Position Management Interface)
 * Called after wizard completes/cancels/fails
 * Always sends a NEW message (cleaner UX)
 */
async function returnToPositionManagement(ctx: BotContext, state: BaseWizardState): Promise<void> {
  const { symbol } = state;

  // Always send new position manager message
  await showPositionManagement(ctx, symbol, false);
}

// ========== MARKET Order Wizard ==========

export const marketOrderScene = new Scenes.WizardScene<BotContext>(
  'market-order-wizard',

  // Step 1: Ask for amount (or use prefilled)
  async (ctx) => {
    const state = ctx.wizard.state as MarketOrderState;

    // Initialize retry count
    if (state.retryCount === undefined) {
      state.retryCount = 0;
    }

    if (!state.symbol || !state.side) {
      await ctx.reply('❌ Invalid wizard state. Please try again.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Check for prefilled amount (from fixed buttons like $50, $200)
    if (state.prefilledAmount) {
      // Skip to step 2 with prefilled amount (step 2 handles isPrefilled case)
      ctx.wizard.selectStep(1);
      // Manually invoke the step
      return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    }

    const action = state.reduceOnly ? 'Sell' : (state.side === 'BUY' ? 'Long' : 'Short');
    const leverage = state.leverage || 5;
    const marginType = state.marginType || 'cross';

    // Clean old button messages before sending wizard prompt
    await cleanupButtonMessages(ctx);

    const sentMessage = await ctx.reply(
      `💰 **${action} ${state.symbol}** (MARKET)\n\n` +
      `Leverage: ${leverage}x ${marginType}\n\n` +
      `Enter amount:\n` +
      `• $50 (USDT)\n` +
      `• 15% (of available margin)\n` +
      `• 0.5 ${state.symbol.replace('USDT', '')}\n\n` +
      `Type your amount:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
      ])}
    );

    // Track wizard message for cleanup
    trackButtonMessage(ctx, sentMessage.message_id);

    return ctx.wizard.next();
  },

  // Step 2: Process amount and confirm
  async (ctx) => {
    const state = ctx.wizard.state as MarketOrderState;

    // For prefilled amounts, skip verification
    const isPrefilled = state.prefilledAmount !== undefined;

    // Verify this is a text message (unless prefilled)
    if (!isPrefilled) {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send a text message with your amount.');
        return; // Stay in same step
      }
    }

    const input = isPrefilled ? state.prefilledAmount! : ctx.message!.text;

    // Check for cancel
    if (input.toLowerCase() === 'cancel' || input === '/cancel') {
      await ctx.reply('❌ Order cancelled.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Parse amount
    const parsed = parseAmount(input, state.symbol);
    if (!parsed) {
      state.retryCount++;

      if (state.retryCount >= 2) {
        const baseAsset = state.symbol.replace('USDT', '');
        await ctx.reply(
          `⚠️ Too many invalid attempts. Returning to position management...\n\n` +
          `Valid formats:\n` +
          `• $50 or 50 → $50 USD\n` +
          `• 15% → 15% of available margin\n` +
          `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
        );
        await returnToPositionManagement(ctx, state);
        return ctx.scene.leave();
      }

      const baseAsset = state.symbol.replace('USDT', '');
      await ctx.reply(
        `❌ Invalid amount format. Please try again.\n\n` +
        `Examples:\n` +
        `• $50 or 50 → $50 USD\n` +
        `• 15% → 15% of available margin\n` +
        `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
      );
      return; // Stay in same step
    }

    // Convert to params
    let quantityParams: any = {};
    if (parsed.type === 'USD') {
      quantityParams.quantityInUSD = parsed.value.toString();
    } else if (parsed.type === 'PERCENT') {
      quantityParams.quantityAsPercent = parsed.value.toString();
    } else if (parsed.type === 'BASE_ASSET') {
      quantityParams.quantity = parsed.value.toString();
    }

    // Add reduceOnly if needed
    if (state.reduceOnly) {
      quantityParams.reduceOnly = 'true';
    }

    // Build operation
    const action = state.reduceOnly ? 'Sell' : (state.side === 'BUY' ? 'Long' : 'Short');
    const operation: AsterWriteOp = {
      operation: 'CREATE_ORDER',
      params: {
        symbol: state.symbol,
        side: state.side,
        type: 'MARKET',
        ...quantityParams,
      },
      metadata: {
        action: `${action} ${input} (${state.leverage || 5}x ${state.marginType || 'cross'})`,
        leverage: state.leverage || 5,
        // Store return context for post-confirmation
        returnTo: state.returnTo,
      },
    };

    // Show confirmation
    const redis = getRedis();
    if (!ctx.session.userId) {
      await ctx.reply('❌ User not found. Please link your API keys first.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Get client for percentage/USD calculations
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

    // Leave wizard (confirmation takes over, or error was already shown)
    return ctx.scene.leave();
  }
);

// ========== LIMIT Order Wizard ==========

export const limitOrderScene = new Scenes.WizardScene<BotContext>(
  'limit-order-wizard',

  // Step 1: Ask for amount (or use prefilled)
  async (ctx) => {
    const state = ctx.wizard.state as LimitOrderState;

    // Initialize retry count
    if (state.retryCount === undefined) {
      state.retryCount = 0;
    }

    if (!state.symbol || !state.side) {
      await ctx.reply('❌ Invalid wizard state. Please try again.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Check for prefilled amount (from fixed buttons like $50, $200)
    if (state.prefilledAmount) {
      // Store the prefilled amount and skip to step 2 (ask for price)
      state.amount = state.prefilledAmount;
      ctx.wizard.selectStep(1);
      // Manually invoke the step
      return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    }

    const action = state.reduceOnly ? 'Sell' : (state.side === 'BUY' ? 'Long' : 'Short');
    const leverage = state.leverage || 5;
    const marginType = state.marginType || 'cross';

    // Clean old button messages before sending wizard prompt
    await cleanupButtonMessages(ctx);

    const sentMessage = await ctx.reply(
      `📊 **${action} ${state.symbol}** (LIMIT)\n\n` +
      `Leverage: ${leverage}x ${marginType}\n\n` +
      `**Step 1/2:** Enter amount:\n` +
      `• $50 (USDT)\n` +
      `• 15% (of available margin)\n` +
      `• 0.5 ${state.symbol.replace('USDT', '')}\n\n` +
      `Type your amount:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
      ])}
    );

    // Track wizard message for cleanup
    trackButtonMessage(ctx, sentMessage.message_id);

    return ctx.wizard.next();
  },

  // Step 2: Validate amount and ask for price
  async (ctx) => {
    const state = ctx.wizard.state as LimitOrderState;

    // If amount already set (prefilled), skip validation
    if (!state.amount) {
      // Verify this is a text message
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Please send a text message with your amount.');
        return; // Stay in same step
      }

      const input = ctx.message.text;

      // Check for cancel
      if (input.toLowerCase() === 'cancel' || input === '/cancel') {
        await ctx.reply('❌ Order cancelled.');
        await returnToPositionManagement(ctx, state);
        return ctx.scene.leave();
      }

      // Parse amount
      const parsed = parseAmount(input, state.symbol);
      if (!parsed) {
        state.retryCount++;

        if (state.retryCount >= 2) {
          const baseAsset = state.symbol.replace('USDT', '');
          await ctx.reply(
            `⚠️ Too many invalid attempts. Returning to position management...\n\n` +
            `Valid formats:\n` +
            `• $50 or 50 → $50 USD\n` +
            `• 15% → 15% of available margin\n` +
            `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
          );
          await returnToPositionManagement(ctx, state);
          return ctx.scene.leave();
        }

        const baseAsset = state.symbol.replace('USDT', '');
        await ctx.reply(
          `❌ Invalid amount format. Please try again.\n\n` +
          `Examples:\n` +
          `• $50 or 50 → $50 USD\n` +
          `• 15% → 15% of available margin\n` +
          `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
        );
        return; // Stay in same step
      }

      // Store amount
      state.amount = input;
    }

    // Ask for price
    // Clean old button messages before sending next prompt
    await cleanupButtonMessages(ctx);

    const sentMessage = await ctx.reply(
      `✅ Amount: ${state.amount}\n\n` +
      `**Step 2/2:** Enter limit price:\n` +
      `Example: 2000.50\n\n` +
      `Type your price:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
      ])}
    );

    // Track wizard message for cleanup
    trackButtonMessage(ctx, sentMessage.message_id);

    return ctx.wizard.next();
  },

  // Step 3: Process price and confirm
  async (ctx) => {
    const state = ctx.wizard.state as LimitOrderState;

    // Verify this is a text message
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send a text message with your price.');
      return; // Stay in same step
    }

    const priceInput = ctx.message.text;

    // Check for cancel
    if (priceInput.toLowerCase() === 'cancel' || priceInput === '/cancel') {
      await ctx.reply('❌ Order cancelled.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Validate price
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) {
      state.retryCount++;

      if (state.retryCount >= 2) {
        await ctx.reply('⚠️ Too many invalid attempts. Returning to position management...');
        await returnToPositionManagement(ctx, state);
        return ctx.scene.leave();
      }

      await ctx.reply('❌ Invalid price. Please enter a valid number.\n\nExample: 2000.50');
      return; // Stay in same step
    }

    // Parse amount from step 1
    const parsed = parseAmount(state.amount!, state.symbol);
    if (!parsed) {
      await ctx.reply('❌ Invalid amount. Starting over...');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Convert to params
    let quantityParams: any = {};
    if (parsed.type === 'USD') {
      quantityParams.quantityInUSD = parsed.value.toString();
    } else if (parsed.type === 'PERCENT') {
      quantityParams.quantityAsPercent = parsed.value.toString();
    } else if (parsed.type === 'BASE_ASSET') {
      quantityParams.quantity = parsed.value.toString();
    }

    // Add reduceOnly if needed
    if (state.reduceOnly) {
      quantityParams.reduceOnly = 'true';
    }

    // Build operation
    const action = state.reduceOnly ? 'Sell' : (state.side === 'BUY' ? 'Long' : 'Short');
    const operation: AsterWriteOp = {
      operation: 'CREATE_ORDER',
      params: {
        symbol: state.symbol,
        side: state.side,
        type: 'LIMIT',
        price: price.toString(),
        ...quantityParams,
      },
      metadata: {
        action: `${action} ${state.amount} @ $${price} (${state.leverage || 5}x ${state.marginType || 'cross'})`,
        leverage: state.leverage || 5,
        // Store return context for post-confirmation
        returnTo: state.returnTo,
      },
    };

    // Show confirmation
    const redis = getRedis();
    if (!ctx.session.userId) {
      await ctx.reply('❌ User not found. Please link your API keys first.');
      await returnToPositionManagement(ctx, state);
      return ctx.scene.leave();
    }

    // Get client for percentage/USD calculations
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

    // Leave wizard (confirmation takes over, or error was already shown)
    return ctx.scene.leave();
  }
);

// ========== Cancel Handler ==========

// Handle cancel button
marketOrderScene.action('cancel_wizard', async (ctx) => {
  const state = ctx.wizard.state as MarketOrderState;
  await ctx.editMessageText('❌ Order cancelled.');

  // Clean button messages before returning to position
  await cleanupButtonMessages(ctx);

  await returnToPositionManagement(ctx, state);
  return ctx.scene.leave();
});

limitOrderScene.action('cancel_wizard', async (ctx) => {
  const state = ctx.wizard.state as LimitOrderState;
  await ctx.editMessageText('❌ Order cancelled.');

  // Clean button messages before returning to position
  await cleanupButtonMessages(ctx);

  await returnToPositionManagement(ctx, state);
  return ctx.scene.leave();
});
