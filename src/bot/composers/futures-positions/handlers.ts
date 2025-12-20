import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../../types/context';
import { UniversalApiService } from '../../services/universal-api.service';
import { buildPositionInterface, showPositionManagement } from './interface';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';

/**
 * Positions handler - Shows all futures positions
 */
export function registerPositionsListHandler(composer: Composer<BotContext>) {
  composer.action('positions', async (ctx) => {
    await ctx.answerCbQuery('🔄 Loading...');
    const activeExchange = ctx.session.activeExchange || 'aster';
    const userId = ctx.session.userId!.toString();

    try {
      const response = await UniversalApiService.getPositions(userId, activeExchange);
      const positions = response.data || [];

      let message = `📊 **Futures Positions (${activeExchange.toUpperCase()})**\n\n`;
      if (positions.length === 0) {
        message += `No open positions.`;
      } else {
        positions.forEach((pos: any) => {
          const size = parseFloat(pos.size);
          if (Math.abs(size) > 0) {
            const side = size > 0 ? '🟢 LONG' : '🔴 SHORT';
            message += `**${pos.symbol}** ${side}\n`;
            message += `Size: ${Math.abs(size).toFixed(4)}\n`;
            message += `PnL: $${parseFloat(pos.unrealizedPnl).toFixed(2)}\n\n`;
          }
        });
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'positions')],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      });
    } catch (error: any) {
      console.error('[Positions List] Error:', error);
      await ctx.editMessageText(`❌ Failed to load positions: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
    }
  });
}

/**
 * Toggle Order Type (Market/Limit)
 */
export function registerToggleOrderTypeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_toggle_order_type:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    const currentType = ctx.session.tradingState?.[symbol]?.orderType || 'MARKET';
    const newType = currentType === 'MARKET' ? 'LIMIT' : 'MARKET';

    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) ctx.session.tradingState[symbol] = {};
    ctx.session.tradingState[symbol].orderType = newType;

    await ctx.answerCbQuery(`Switched to ${newType}`);
    await showPositionManagement(ctx, symbol, true);
  });
}

/**
 * Toggle Margin Mode (Cross/Isolated)
 */
export function registerToggleMarginHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_toggle_margin:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    const currentMode = ctx.session.tradingState?.[symbol]?.marginMode || 'CROSS';
    const newMode = currentMode === 'CROSS' ? 'ISOLATED' : 'CROSS';

    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) ctx.session.tradingState[symbol] = {};
    ctx.session.tradingState[symbol].marginMode = newMode;

    await ctx.answerCbQuery(`Switched to ${newMode}`);
    await showPositionManagement(ctx, symbol, true);
  });
}

/**
 * Leverage Menu Handler
 */
export function registerLeverageMenuHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_leverage_menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(`⚙️ **Set Leverage - ${symbol}**\n\nChoose leverage:`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('2x', `pos_set_leverage:${symbol}:2`),
          Markup.button.callback('5x', `pos_set_leverage:${symbol}:5`),
          Markup.button.callback('10x', `pos_set_leverage:${symbol}:10`),
        ],
        [
          Markup.button.callback('20x', `pos_set_leverage:${symbol}:20`),
          Markup.button.callback('50x', `pos_set_leverage:${symbol}:50`),
          Markup.button.callback('Custom', `pos_leverage_custom:${symbol}`),
        ],
        [Markup.button.callback('« Back', `pos_refresh:${symbol}`)],
      ]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Set Leverage Handler
 */
export function registerSetLeverageHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_set_leverage:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const leverage = parseInt(ctx.match[2]);

    // Enter leverage wizard scene with prefilled leverage
    await ctx.scene.enter('leverage-wizard', { symbol, leverage });
  });
}

/**
 * Leverage Custom Handler
 */
export function registerLeverageCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_leverage_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    // Enter leverage wizard scene
    await ctx.scene.enter('leverage-wizard', { symbol });
  });
}

/**
 * Margin Management Handler - Opens margin wizard
 */
export function registerMarginManagementHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_manage_margin:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    
    // Enter margin wizard scene
    await ctx.scene.enter('margin-wizard', { symbol });
  });
}

/**
 * Refresh Handler
 */
export function registerRefreshHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_refresh:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('🔄 Refreshing...');
    const symbol = ctx.match[1];
    await showPositionManagement(ctx, symbol, true);
  });
}

/**
 * TP/SL Mode Handler
 */
export function registerTPSLModeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_mode_tpsl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    await showPositionManagement(ctx, symbol, true, 'tpsl');
  });
}

/**
 * Orders Mode Handler
 */
export function registerOrdersModeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_mode_orders:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    await showPositionManagement(ctx, symbol, true, 'orders');
  });
}

/**
 * Default Settings Handler
 */
export function registerDefaultSettingsHandler(composer: Composer<BotContext>) {
  composer.action('default_settings', async (ctx) => {
    await ctx.answerCbQuery('Default settings coming later!');
  });
}
