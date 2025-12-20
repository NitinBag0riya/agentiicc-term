import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { showPositionManagement } from '../composers/futures-positions/interface';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

interface TradeWizardState {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  amount?: string;
  price?: string;
  prefilledAmount?: string;
}

async function returnToPositionManagement(ctx: BotContext, symbol: string) {
  await showPositionManagement(ctx, symbol, false);
}

/**
 * MARKET Order Wizard
 */
export const marketOrderScene = new Scenes.WizardScene<BotContext>(
  'market-order-wizard',
  // Step 1: Handle prefilled or ask for amount
  async (ctx) => {
    const state = ctx.wizard.state as TradeWizardState;
    if (state.prefilledAmount) {
      state.amount = state.prefilledAmount;
      // We skip the prompt and go to execution
      return executeMarketOrder(ctx);
    }

    const sent = await ctx.reply(
      `💰 **Market ${state.side} ${state.symbol}**\n\nEnter amount (e.g. 50, 0.1 BTC, 10%):`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_wizard')]]) }
    );
    trackButtonMessage(ctx, sent.message_id);
    return ctx.wizard.next();
  },
  // Step 2: Handle user input and execute
  async (ctx) => {
    const state = ctx.wizard.state as TradeWizardState;
    if (ctx.message && 'text' in ctx.message) {
      state.amount = ctx.message.text.trim();
    }
    return executeMarketOrder(ctx);
  }
);

async function executeMarketOrder(ctx: BotContext) {
  const state = ctx.wizard.state as TradeWizardState;
  if (!state.amount) return;

  await ctx.reply(`⏳ Executing Market ${state.side}...`);
  try {
    const activeExchange = ctx.session.activeExchange || 'aster';
    await UniversalApiService.placeOrder(ctx.session.userId!.toString(), {
      exchange: activeExchange,
      symbol: state.symbol,
      side: state.side,
      type: 'MARKET',
      amount: state.amount,
    });
    await ctx.reply(`✅ Market ${state.side} Successful!`);
  } catch (error: any) {
    await ctx.reply(`❌ Order Failed: ${error.message}`);
  }
  await returnToPositionManagement(ctx, state.symbol);
  return ctx.scene.leave();
}

/**
 * LIMIT Order Wizard
 */
export const limitOrderScene = new Scenes.WizardScene<BotContext>(
  'limit-order-wizard',
  // Step 1: Handle prefilled or ask for amount
  async (ctx) => {
    const state = ctx.wizard.state as TradeWizardState;
    if (state.prefilledAmount) {
      state.amount = state.prefilledAmount;
      await ctx.reply(`📈 Enter limit price for ${state.amount} ${state.symbol}:`);
      return ctx.wizard.selectStep(2); // Skip to step 2 (price)
    }
    await ctx.reply(`📊 **Limit ${state.side} ${state.symbol}**\n\nEnter amount:`);
    return ctx.wizard.next();
  },
  // Step 2: Ask for price
  async (ctx) => {
    const state = ctx.wizard.state as TradeWizardState;
    if (!state.amount && ctx.message && 'text' in ctx.message) {
      state.amount = ctx.message.text.trim();
    }
    await ctx.reply(`📈 Enter limit price:`);
    return ctx.wizard.next();
  },
  // Step 3: Execute
  async (ctx) => {
    const state = ctx.wizard.state as TradeWizardState;
    if (ctx.message && 'text' in ctx.message) {
      state.price = ctx.message.text.trim();
    }
    if (!state.price) return;

    await ctx.reply(`⏳ Placing Limit ${state.side}...`);
    try {
      const activeExchange = ctx.session.activeExchange || 'aster';
      await UniversalApiService.placeOrder(ctx.session.userId!.toString(), {
        exchange: activeExchange,
        symbol: state.symbol,
        side: state.side,
        type: 'LIMIT',
        amount: state.amount,
        price: state.price,
      });
      await ctx.reply(`✅ Limit ${state.side} Placed!`);
    } catch (error: any) {
      await ctx.reply(`❌ Order Failed: ${error.message}`);
    }
    await returnToPositionManagement(ctx, state.symbol);
    return ctx.scene.leave();
  }
);

marketOrderScene.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await returnToPositionManagement(ctx, (ctx.wizard.state as TradeWizardState).symbol);
  return ctx.scene.leave();
});

limitOrderScene.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await returnToPositionManagement(ctx, (ctx.wizard.state as TradeWizardState).symbol);
  return ctx.scene.leave();
});
