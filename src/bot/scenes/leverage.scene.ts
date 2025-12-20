import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';
import { showPositionManagement } from '../composers/futures-positions';

interface LeverageWizardState {
  symbol: string;
  leverage?: number;
  currentLeverage?: number;
}

/**
 * Leverage Setting Wizard
 */
export const leverageWizard = new Scenes.WizardScene<BotContext>(
  'leverage-wizard',

  // Step 1: Input or skip to execution
  async (ctx) => {
    const state = ctx.wizard.state as LeverageWizardState;
    const userId = ctx.session.userId?.toString();
    const exchange = ctx.session.activeExchange;

    if (!state.symbol || !userId || !exchange) {
      await ctx.reply('❌ Invalid session state.');
      return ctx.scene.leave();
    }

    if (state.leverage) {
      return (leverageWizard.steps[1] as any)(ctx);
    }

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

  // Step 2: Execution
  async (ctx) => {
    const state = ctx.wizard.state as LeverageWizardState;
    const userId = ctx.session.userId?.toString();
    const exchange = ctx.session.activeExchange;

    if (ctx.message && 'text' in ctx.message) {
      const lev = parseInt(ctx.message.text.trim());
      if (isNaN(lev) || lev < 1 || lev > 125) {
        await ctx.reply('❌ Invalid leverage. Enter 1-125.');
        return;
      }
      state.leverage = lev;
    }

    if (!state.leverage) return;

    if (!userId || !exchange) {
      await ctx.reply('❌ Session error.');
      return ctx.scene.leave();
    }

    try {
      await ctx.reply(`⏳ Setting leverage to ${state.leverage}x...`);
      await UniversalApiService.setLeverage(userId, state.symbol, state.leverage, exchange);

      await ctx.reply(`✅ Successfully set leverage to **${state.leverage}x** for ${state.symbol}.`);
      await ctx.scene.leave();
      await showPositionManagement(ctx, state.symbol, false);
    } catch (error: any) {
      console.error('[Leverage Wizard] Error:', error);
      await ctx.reply(`❌ Failed to set leverage: ${error.message}`);
      await ctx.scene.leave();
    }
  }
);

leverageWizard.action(/^lev_preset_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as LeverageWizardState;
  state.leverage = parseInt(ctx.match[1]);
  return (leverageWizard.steps[1] as any)(ctx);
});

leverageWizard.action('lev_cancel', async (ctx) => {
  await ctx.answerCbQuery('❌ Cancelled');
  const state = ctx.wizard.state as LeverageWizardState;
  await ctx.scene.leave();
  await ctx.reply('❌ Leverage change cancelled.');
  if (state.symbol) await showPositionManagement(ctx, state.symbol, false);
});
