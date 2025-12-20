import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

interface SpotBuyWizardState {
  asset: string;
  symbol: string;
  amount?: string;
  prefilledAmount?: string;
}

export const spotBuyWizard = new Scenes.WizardScene<BotContext>(
  'spot-buy-wizard',
  async (ctx) => {
    const state = ctx.wizard.state as SpotBuyWizardState;
    if (state.prefilledAmount) {
      state.amount = state.prefilledAmount;
      return executeSpotBuy(ctx);
    }
    await cleanupButtonMessages(ctx);
    const sent = await ctx.reply(
      `💰 **Buy ${state.asset}** (Spot)\n\nEnter amount (e.g. 50, 0.1 ${state.asset}, 25%):`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_wizard')]]) }
    );
    trackButtonMessage(ctx, sent.message_id);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const state = ctx.wizard.state as SpotBuyWizardState;
    if (ctx.message && 'text' in ctx.message) {
      state.amount = ctx.message.text.trim();
    }
    return executeSpotBuy(ctx);
  }
);

async function executeSpotBuy(ctx: BotContext) {
  const state = ctx.wizard.state as SpotBuyWizardState;
  if (!state.amount) return;

  await ctx.reply(`⏳ Executing Spot Buy ${state.asset}...`);
  try {
    const exchange = ctx.session.activeExchange || 'aster';
    await UniversalApiService.placeOrder(ctx.session.userId!.toString(), {
      exchange,
      symbol: state.symbol,
      side: 'BUY',
      type: 'MARKET',
      amount: state.amount,
    });
    await ctx.reply(`✅ Successfully bought ${state.asset}!`);
  } catch (error: any) {
    await ctx.reply(`❌ Purchase Failed: ${error.message}`);
  }
  await ctx.scene.leave();
}

spotBuyWizard.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('❌ Purchase cancelled.');
  return ctx.scene.leave();
});
