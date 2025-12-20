import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';
import { showPositionManagement } from '../composers/futures-positions';

interface MarginWizardState {
  symbol: string;
  action?: 'add' | 'reduce';
  amount?: string;
  currentIsolatedMargin?: string;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
}

/**
 * Isolated Margin Management Wizard
 */
export const marginWizard = new Scenes.WizardScene<BotContext>(
  'margin-wizard',

  // Step 1: Init & Selection
  async (ctx) => {
    const state = ctx.wizard.state as MarginWizardState;
    const userId = ctx.session.userId?.toString();
    const exchange = ctx.session.activeExchange;

    if (!state.symbol || !userId || !exchange) {
      await ctx.reply('❌ Invalid session state.');
      return ctx.scene.leave();
    }

    try {
      const positions = await UniversalApiService.getPositions(userId, exchange);
      const position = positions.find((p: any) => p.symbol === state.symbol);

      if (!position) {
        await ctx.reply(`❌ No open position found for ${state.symbol}.`);
        return ctx.scene.leave();
      }

      state.currentIsolatedMargin = position.isolatedMargin || '0';
      state.positionSide = position.side;

      await cleanupButtonMessages(ctx);
      const message = await ctx.reply(
        `🛠️ **Margin Management - ${state.symbol}**\n\n` +
        `**Side:** ${state.positionSide}\n` +
        `**Current Margin:** $${parseFloat(state.currentIsolatedMargin).toFixed(2)}\n\n` +
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
    } catch (error: any) {
      console.error('[Margin Wizard] Error:', error);
      await ctx.reply('❌ Failed to load position info.');
      return ctx.scene.leave();
    }

    return ctx.wizard.next();
  },

  // Step 2: Amount & Execution
  async (ctx) => {
    const state = ctx.wizard.state as MarginWizardState;
    const userId = ctx.session.userId?.toString();
    const exchange = ctx.session.activeExchange;

    if (!state.action) return;

    if (ctx.message && 'text' in ctx.message) {
      const amount = parseFloat(ctx.message.text.trim());
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply('❌ Invalid amount. Enter a positive number.');
        return;
      }
      state.amount = amount.toString();
    }

    if (!state.amount) return;

    if (!userId || !exchange) {
      await ctx.reply('❌ Session error.');
      return ctx.scene.leave();
    }

    try {
      await ctx.reply(`⏳ Processing ${state.action === 'add' ? 'Add' : 'Reduce'} Margin...`);
      await UniversalApiService.updatePositionMargin(
        userId,
        state.symbol,
        state.amount,
        state.action === 'add' ? 'ADD' : 'REMOVE',
        exchange
      );

      await ctx.reply(`✅ Successfully ${state.action === 'add' ? 'added' : 'reduced'} $${state.amount} margin for ${state.symbol}.`);
      await ctx.scene.leave();
      await showPositionManagement(ctx, state.symbol, false);
    } catch (error: any) {
      console.error('[Margin Wizard] Error:', error);
      await ctx.reply(`❌ Failed: ${error.message}`);
      await ctx.scene.leave();
    }
  }
);

marginWizard.action(/^margin_action_(add|reduce)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as MarginWizardState;
  state.action = ctx.match[1] as 'add' | 'reduce';

  await cleanupButtonMessages(ctx);
  const message = await ctx.reply(
    `${state.action === 'add' ? '➕' : '➖'} **${state.action.toUpperCase()} Margin**\n\n` +
    `Current: **$${parseFloat(state.currentIsolatedMargin || '0').toFixed(2)}**\n\n` +
    `Enter amount in USDT:`,
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
});

marginWizard.action(/^margin_preset_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as MarginWizardState;
  state.amount = ctx.match[1];
  return (marginWizard.steps[1] as any)(ctx);
});

marginWizard.action('margin_cancel', async (ctx) => {
  await ctx.answerCbQuery('❌ Cancelled');
  const state = ctx.wizard.state as MarginWizardState;
  await ctx.scene.leave();
  await ctx.reply('❌ Operation cancelled.');
  if (state.symbol) await showPositionManagement(ctx, state.symbol, false);
});
