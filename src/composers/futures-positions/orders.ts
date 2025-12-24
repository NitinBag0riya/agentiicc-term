/**
 * Order Management Handlers
 *
 * Manage, cancel, and view orders
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { UniversalApiClient } from '../../services/universalApi';
import { showConfirmation } from '../../utils/confirmDialog';
import type { AsterWriteOp } from '../../services/ops/types';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';

/**
 * Manage Orders - Show open orders for symbol
 */
export function registerManageOrdersHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_manage_orders:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    try {
      const redis = getRedis();
      const db = getPostgres();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId, ctx.session.activeExchange);

      // Fetch open orders for this symbol
      const ordersRes = await client.getOpenOrders(symbol, ctx.session.activeExchange);
      if (!ordersRes.success) throw new Error(ordersRes.error);
      const openOrders = ordersRes.data;

      // Store orders in session for index-based cancellation
      if (!ctx.session.tradingState) ctx.session.tradingState = {};
      if (!ctx.session.tradingState[symbol]) {
        ctx.session.tradingState[symbol] = { orderType: 'Market', leverage: 5, marginType: 'cross' };
      }
      ctx.session.tradingState[symbol].openOrders = openOrders;

      // Build message (no markdown parsing, just plain text)
      let message = `📋 Manage Orders - ${symbol}\n\n`;

      if (openOrders.length === 0) {
        message += `No open orders\n`;
      } else {
        openOrders.forEach((order, index) => {
          const orderType = order.type === 'STOP_MARKET' || order.type === 'TAKE_PROFIT_MARKET'
            ? `${order.type} (TP/SL)`
            : order.type;
          const side = order.side === 'BUY' ? '🟢 BUY' : '🔴 SELL';

          message += `${index + 1}. ${orderType}\n`;
          message += `${side} ${order.origQty} @ ${order.stopPrice || order.price || 'Market'}\n`;
          message += `ID: ${order.orderId}\n`;
          message += `Status: ${order.status}\n\n`;
        });
      }

      message += `Total: ${openOrders.length} open order(s)`;

      await ctx.editMessageText(message, {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Cancel All', `pos_cancel_all:${symbol}`),
            Markup.button.callback('Cancel X', `pos_cancel_custom:${symbol}`),
          ],
          [Markup.button.callback('« Back', `pos_refresh:${symbol}`)],
        ]),
      });
    } catch (error) {
      console.error('[Manage Orders] Error:', error);
      await ctx.answerCbQuery('Failed to load orders');
    }
  });
}

/**
 * Cancel All Orders
 */
export function registerCancelAllOrdersHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_cancel_all:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    try {
      const redis = getRedis();

      // Get current open orders count for metadata
      // Get current open orders count for metadata
      const db = getPostgres();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId, ctx.session.activeExchange);
      
      const ordersRes = await client.getOpenOrders(symbol, ctx.session.activeExchange);
      if (!ordersRes.success) throw new Error(ordersRes.error);
      const openOrders = ordersRes.data;

      // Build write operation
      const operation: AsterWriteOp = {
        operation: 'CANCEL_ALL_ORDERS',
        params: {
          symbol,
          exchange: ctx.session.activeExchange,
        },
        metadata: {
          orderCount: openOrders.length,
        },
      };

      // Show confirmation dialog
      await showConfirmation(ctx, db, redis, ctx.session.userId, operation);
    } catch (error) {
      console.error('[Cancel All Orders] Error:', error);

      let errorMessage = '❌ Failed to prepare cancellation';
      if (error instanceof Error) {
        errorMessage += `\n\n${error.message}`;
      }

      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply(errorMessage, {
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    }
  });
}

/**
 * Cancel Custom Orders (X)
 */
export function registerCancelCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_cancel_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter order numbers to cancel:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'cancel_custom' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter order number(s) to cancel (e.g., 1 or 1,2,3):', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

// NOTE: registerCancelConfirmHandler removed - now handled by global write_confirm handler in bot.ts
