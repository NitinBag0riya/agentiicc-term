/**
 * Trade Asset Selection Scene
 * 
 * Allows users to search for an asset to trade.
 * Supports finding assets in both Spot and Futures markets.
 */
import { Scenes, Markup, Composer } from 'telegraf';
import { BotContext, BotWizardContext } from '../types/context';
import { getFuturesTradingSymbols } from '../services/exchangeInfo.service';
import { showPositionManagement } from '../composers/futures-positions/interface';
import { exitSceneToMenu } from '../utils/countdown';
import { cleanupButtonMessages } from '../utils/buttonCleanup';

// Define steps separately to avoid self-reference/type issues
const step1 = async (ctx: BotWizardContext) => {
    // If scene started with state (e.g. from /trade BTC), use it
    const state = ctx.wizard.state as { symbol?: string };
    
    if (state.symbol) {
      // Jump to validation - manually execute logic of step 2
      // We can't easily jump and execute in same tick without access to internal array.
      // So we just call step2 manually.
      return step2(ctx); 
    }

    await cleanupButtonMessages(ctx);

    await ctx.reply(
      '🔍 **Trade - Asset Search**\n\n' +
      'Enter the symbol you want to trade (e.g., `BTC`, `ETH`):',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔥 BTC', 'select_BTC'), Markup.button.callback('💎 ETH', 'select_ETH'), Markup.button.callback('☀️ SOL', 'select_SOL')],
          [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
        ])
      }
    );

    return ctx.wizard.next();
};

const step2 = async (ctx: BotWizardContext) => {
    let symbolInput = '';

    // Handle text input
    if (ctx.message && 'text' in ctx.message) {
      symbolInput = ctx.message.text.trim();
    } 
    // Handle callback queries (from buttons)
    else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      const data = (ctx.callbackQuery.data as string);
      if (data.startsWith('select_')) {
        symbolInput = data.replace('select_', '');
        await ctx.answerCbQuery();
      } else if (data === 'cancel_wizard') {
        await ctx.answerCbQuery();
        return ctx.scene.leave();
      }
    }
    // Handle pre-filled state
    else if (ctx.wizard.state && (ctx.wizard.state as any).symbol) {
        symbolInput = (ctx.wizard.state as any).symbol;
    }

    if (!symbolInput) {
       // Ignore non-text/non-button updates
       return;
    }
    
    // Check for commands
    if (symbolInput.startsWith('/')) {
        await ctx.scene.leave();
        return; 
    }

    const rawSymbol = symbolInput.toUpperCase();
    const cleanSymbol = rawSymbol.replace('USDT', '').replace('PERP', ''); 
    // We assume USDT based.

    const exchange = ctx.session.activeExchange || 'aster';
    const futuresSymbols = await getFuturesTradingSymbols(exchange);
    
    // Check Futures First (Priority)
    // Try explicit match first, then with USDT appended
    let validFuturesSymbol = futuresSymbols.find(s => s === rawSymbol || s === `${cleanSymbol}USDT` || s === `${cleanSymbol}PERP`);
    
    if (validFuturesSymbol) {
        await ctx.reply(`✅ Found **${validFuturesSymbol}** in Futures. Opening trade interface...`, { parse_mode: 'Markdown' });
        await showPositionManagement(ctx, validFuturesSymbol, false);
        return ctx.scene.leave(); // Exit scene, position management replaces it
    }

    // If not found
    await ctx.reply(
        `❌ Symbol **${cleanSymbol}** not found in Futures markets on ${exchange}.\n\n` +
        `Please try another symbol:`,
        { parse_mode: 'Markdown' }
    );
    
    // If we were called manually from step 1, we need to advance if we want to stay in loop?
    // Actually if we return undefined, we stay in current step?
    // If called manually from step 1, cursor is still at 0 unless we changed it.
    // If we are in step 2 (wizard.next was called), cursor is 1.
    return;
};

export const tradeAssetScene = new Scenes.WizardScene<BotWizardContext>(
  'trade-asset-wizard',
  step1,
  step2
);

// Cancel handler
tradeAssetScene.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await exitSceneToMenu(ctx, '❌ Trade cancelled.');
  return ctx.scene.leave();
});
