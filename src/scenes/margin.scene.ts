/**
 * Isolated Margin Management Wizard
 *
 * Multi-step wizard for adding or reducing margin on isolated positions
 */
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { getRedis } from '../db/redis';
import { getPostgres } from '../db/postgres';
import { UniversalApiClient } from '../services/universalApi';
import { showConfirmation } from '../utils/confirmDialog';
import type { AsterWriteOp } from '../services/ops/types';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';
import { showPositionManagement } from '../composers/futures-positions';

interface MarginWizardState {
  symbol: string;
  action?: 'add' | 'reduce';
  amount?: string;
  currentIsolatedMargin?: string;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
}

/**
 * Isolated Margin Wizard
 *
 * Steps:
 * 1. Choose action (Add or Reduce)
 * 2. Enter amount
 * 3. Confirm
 * 4. Execute API call
 */
export const marginWizard = new Scenes.WizardScene<BotContext>(
  'margin-wizard',

  // Step 1: Choose action (Add or Reduce)
  async (ctx) => {
    const state = ctx.wizard.state as MarginWizardState;

    if (!state.symbol) {
      await ctx.reply('❌ Invalid state. Please try again.');
      return ctx.scene.leave();
    }

    // Check if position is isolated
    if (!ctx.session.userId) {
      await ctx.reply('❌ Session error. Please try again.');
      return ctx.scene.leave();
    }

    const redis = getRedis();
    const db = getPostgres();

    try {
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);
      const positionsRes = await client.getPositions();
      
      if (!positionsRes.success) {
          throw new Error(positionsRes.error || 'Failed to fetch positions');
      }

      const positions = positionsRes.data as any[];
      const position = positions.find(p => p.symbol === state.symbol && parseFloat(p.positionAmt) !== 0);

      if (!position) {
        await ctx.reply(`❌ No open position found for ${state.symbol}.`);
        return ctx.scene.leave();
      }

      if (position.marginType.toUpperCase() !== 'ISOLATED') {
        await ctx.reply(
          `❌ This position is in **${position.marginType}** mode.\n\n` +
          `Margin management is only available for **Isolated** positions.`,
          { parse_mode: 'Markdown' }
        );
        return ctx.scene.leave();
      }

      // Store position info
      state.currentIsolatedMargin = position.isolatedMargin;
      state.positionSide = position.positionSide as 'BOTH' | 'LONG' | 'SHORT';

      await cleanupButtonMessages(ctx);
      const message = await ctx.reply(
        `🛠️ **Margin Management - ${state.symbol}**\n\n` +
        `**Position Side:** ${state.positionSide}\n` +
        `**Current Isolated Margin:** $${parseFloat(state.currentIsolatedMargin).toFixed(2)}\n\n` +
        `What would you like to do?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('➕ Add Margin', 'margin_action_add'),
              Markup.button.callback('➖ Reduce Margin', 'margin_action_reduce'),
            ],
            [Markup.button.callback('❌ Cancel', 'margin_cancel')],
          ]),
        }
      );
      trackButtonMessage(ctx, message.message_id);

    } catch (error) {
      console.error('[Margin Wizard] Error:', error);
      await ctx.reply('❌ Failed to load position info. Please try again.');
      return ctx.scene.leave();
    }

    return ctx.wizard.next();
  },

  // Step 2: Enter amount
  async (ctx) => {
    const state = ctx.wizard.state as MarginWizardState;

    // If no action selected yet, wait for button press
    if (!state.action) {
      return; // Stay on same step
    }

    // Handle text input for amount
    if (ctx.message && 'text' in ctx.message) {
      const input = ctx.message.text.trim();
      const amount = parseFloat(input);

      if (isNaN(amount) || amount <= 0) {
        await ctx.reply(
          `❌ Invalid amount. Please enter a positive number.`,
          { parse_mode: 'Markdown' }
        );
        return; // Stay on same step
      }

      state.amount = amount.toString();
    }

    // Validate we have amount
    if (!state.amount) {
      await ctx.reply('❌ Please enter an amount.');
      return; // Stay on same step
    }

    // Leave scene and execute operation
    await ctx.scene.leave();

    if (!ctx.session.userId) {
      await ctx.reply('❌ Session error. Please try again.');
      return;
    }

    const redis = getRedis();
    const db = getPostgres();

    try {
      // Get client
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);

      // Calculate new margin
      const currentMargin = parseFloat(state.currentIsolatedMargin || '0');
      const changeAmount = parseFloat(state.amount);
      const newMargin = state.action === 'add'
        ? currentMargin + changeAmount
        : currentMargin - changeAmount;

      // Create MODIFY_ISOLATED_MARGIN operation
      const operation: AsterWriteOp = {
        operation: 'MODIFY_ISOLATED_MARGIN',
        params: {
          symbol: state.symbol,
          amount: state.amount,
          type: state.action === 'add' ? '1' : '2',
          positionSide: state.positionSide,
        },
        metadata: {
          actionLabel: `${state.action === 'add' ? 'Add' : 'Reduce'} $${state.amount} margin`,
          currentIsolatedMargin: state.currentIsolatedMargin,
          newIsolatedMargin: newMargin.toFixed(2),
        },
      };

      // Show confirmation
      const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

      if (!operationId) {
        // Error was already handled in showConfirmation
        return;
      }

    } catch (error) {
      console.error('[Margin Wizard] Error:', error);
      await ctx.reply('❌ Failed to modify margin. Please try again.');
    }
  }
);

// Handle action selection
marginWizard.action(/^margin_action_(add|reduce)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const action = ctx.match[1] as 'add' | 'reduce';
  const state = ctx.wizard.state as MarginWizardState;

  state.action = action;

  // Ask for amount
  await cleanupButtonMessages(ctx);
  const actionText = action === 'add' ? 'Add' : 'Reduce';
  const message = await ctx.reply(
    `${action === 'add' ? '➕' : '➖'} **${actionText} Margin**\n\n` +
    `Current margin: **$${parseFloat(state.currentIsolatedMargin || '0').toFixed(2)}**\n\n` +
    `Please enter amount in USDT:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('$10', 'margin_preset_10'),
          Markup.button.callback('$50', 'margin_preset_50'),
          Markup.button.callback('$100', 'margin_preset_100'),
        ],
        [Markup.button.callback('❌ Cancel', 'margin_cancel')],
      ]),
    }
  );
  trackButtonMessage(ctx, message.message_id);

  // Don't call the step - just wait for user input
});

// Handle preset amounts
marginWizard.action(/^margin_preset_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const amount = ctx.match[1];
  const state = ctx.wizard.state as MarginWizardState;

  state.amount = amount;

  // Move to confirmation step
  return ctx.wizard.steps[ctx.wizard.cursor](ctx);
});

// Handle cancel
marginWizard.action('margin_cancel', async (ctx) => {
  await ctx.answerCbQuery('❌ Cancelled');
  const state = ctx.wizard.state as MarginWizardState;

  await ctx.scene.leave();
  await ctx.reply('❌ Margin operation cancelled.');

  // Return to position management
  if (state.symbol) {
    await showPositionManagement(ctx, state.symbol, false);
  }
});
