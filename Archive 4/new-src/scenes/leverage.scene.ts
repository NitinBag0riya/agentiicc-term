/**
 * Leverage Wizard Scene
 *
 * Multi-step wizard for setting leverage with confirmation
 */
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { getRedis } from '../db/redis';
import { getPostgres } from '../db/postgres';
import { getAsterClientForUser } from '../aster/helpers';
import { showConfirmation } from '../utils/confirmDialog';
import type { AsterWriteOp } from '../aster/writeOps';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';
import { showPositionManagement } from '../composers/futures-positions';

interface LeverageWizardState {
  symbol: string;
  leverage?: number;
  currentLeverage?: number;
  hasOpenPosition?: boolean;
}

/**
 * Leverage Setting Wizard
 *
 * Steps:
 * 1. Enter leverage value (1-125)
 * 2. Confirm change
 * 3. Execute API call
 */
export const leverageWizard = new Scenes.WizardScene<BotContext>(
  'leverage-wizard',

  // Step 1: Enter leverage (or skip if preset value provided)
  async (ctx) => {
    const state = ctx.wizard.state as LeverageWizardState;

    if (!state.symbol) {
      await ctx.reply('❌ Invalid state. Please try again.');
      return ctx.scene.leave();
    }

    // If leverage is already set (preset button clicked), skip to confirmation
    if (state.leverage) {
      ctx.wizard.selectStep(1); // Move to step 2
      return ctx.wizard.steps[1](ctx);
    }

    // Otherwise, ask for input
    await cleanupButtonMessages(ctx);
    const message = await ctx.reply(
      `⚙️ **Set Leverage - ${state.symbol}**\n\n` +
      `Current leverage: **${state.currentLeverage || '?'}x**\n\n` +
      `Please enter new leverage (1-125):`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('2x', 'lev_preset_2'),
            Markup.button.callback('5x', 'lev_preset_5'),
            Markup.button.callback('10x', 'lev_preset_10'),
            Markup.button.callback('20x', 'lev_preset_20'),
          ],
          [Markup.button.callback('❌ Cancel', 'lev_cancel')],
        ]),
      }
    );
    trackButtonMessage(ctx, message.message_id);

    return ctx.wizard.next();
  },

  // Step 2: Handle input and show confirmation
  async (ctx) => {
    const state = ctx.wizard.state as LeverageWizardState;

    // Handle text input
    if (ctx.message && 'text' in ctx.message) {
      const input = ctx.message.text.trim();
      const leverage = parseInt(input);

      if (isNaN(leverage) || leverage < 1 || leverage > 125) {
        await ctx.reply(
          `❌ Invalid leverage. Please enter a number between 1 and 125.`,
          { parse_mode: 'Markdown' }
        );
        return; // Stay on same step
      }

      state.leverage = leverage;
    }

    // Validate we have leverage
    if (!state.leverage) {
      await ctx.reply('❌ Please enter a leverage value.');
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
      const client = await getAsterClientForUser(ctx.session.userId, db, redis);

      // Create SET_LEVERAGE operation
      const operation: AsterWriteOp = {
        operation: 'SET_LEVERAGE',
        params: {
          symbol: state.symbol,
          leverage: state.leverage,
        },
        metadata: {
          previousLeverage: state.currentLeverage,
          hasOpenPosition: state.hasOpenPosition,
        },
      };

      // Show confirmation
      const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

      if (!operationId) {
        // Error was already handled in showConfirmation
        return;
      }

    } catch (error) {
      console.error('[Leverage Wizard] Error:', error);
      await ctx.reply('❌ Failed to set leverage. Please try again.');
    }
  }
);

// Handle preset buttons
leverageWizard.action(/^lev_preset_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const leverage = parseInt(ctx.match[1]);
  const state = ctx.wizard.state as LeverageWizardState;

  state.leverage = leverage;

  // Move to confirmation step
  return ctx.wizard.steps[ctx.wizard.cursor](ctx);
});

// Handle cancel
leverageWizard.action('lev_cancel', async (ctx) => {
  await ctx.answerCbQuery('❌ Cancelled');
  const state = ctx.wizard.state as LeverageWizardState;

  await ctx.scene.leave();
  await ctx.reply('❌ Leverage change cancelled.');

  // Return to position management
  if (state.symbol) {
    await showPositionManagement(ctx, state.symbol, false);
  }
});
