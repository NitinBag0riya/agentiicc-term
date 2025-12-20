import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

interface SpotSellWizardState {
  asset: string;
  symbol: string;
  amount?: string;
  prefilledAmount?: string;
}

export const spotSellWizard = new Scenes.WizardScene<BotContext>(
  'spot-sell-wizard',
  async (ctx) => {
    const state = ctx.wizard.state as SpotSellWizardState;
    if (state.prefilledAmount) {
      state.amount = state.prefilledAmount;
      return executeSpotSell(ctx);
    }
    await cleanupButtonMessages(ctx);
    const sent = await ctx.reply(
      `💰 **Sell ${state.asset}** (Spot)\n\nEnter amount (e.g. 50, 0.1 ${state.asset}, 25%):`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_wizard')]]) }
    );
    trackButtonMessage(ctx, sent.message_id);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const state = ctx.wizard.state as SpotSellWizardState;
    if (ctx.message && 'text' in ctx.message) {
      state.amount = ctx.message.text.trim();
    }
    return executeSpotSell(ctx);
  }
);

async function executeSpotSell(ctx: BotContext) {
  const state = ctx.wizard.state as SpotSellWizardState;
  if (!state.amount) return;

  await ctx.reply(`⏳ Executing Spot Sell ${state.asset}...`);
  try {
    const exchange = ctx.session.activeExchange || 'aster';
    await UniversalApiService.placeOrder(ctx.session.userId!.toString(), {
      exchange,
      symbol: state.symbol,
      side: 'SELL',
      type: 'MARKET',
      amount: state.amount,
    });
    await ctx.reply(`✅ Successfully sold ${state.asset}!`);
  } catch (error: any) {
    await ctx.reply(`❌ Sale Failed: ${error.message}`);
  }
  await ctx.scene.leave();
}

spotSellWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('❌ Sale cancelled.');
  return ctx.scene.leave();
});
