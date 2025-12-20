import { Markup } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/types';
import type { BotContext } from '../../types/context';
import { UniversalApiService } from '../../services/universal-api.service';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';

/**
 * Helper to build position management message and buttons
 */
export async function buildPositionInterface(ctx: BotContext, symbol: string, usePlaceholders = false) {
  const activeExchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.session.userId!.toString();

  if (!ctx.session.tradingState) ctx.session.tradingState = {};
  if (!ctx.session.tradingState[symbol]) {
    ctx.session.tradingState[symbol] = {
      orderType: 'Market',
      leverage: 5,
      marginType: 'cross',
    };
  }

  const state = ctx.session.tradingState[symbol];
  
  // Fetch actual data
  const positionsResponse = await UniversalApiService.getPositions(userId, activeExchange);
  const openOrdersResponse = await UniversalApiService.getOpenOrders(userId, activeExchange, symbol);
  
  const positions = positionsResponse.data || [];
  const openOrders = openOrdersResponse.data || [];
  const position = positions.find((p: any) => p.symbol === symbol && parseFloat(p.size) !== 0);
  
  const baseAsset = symbol.replace(/USDT$|USD$|BTC$|ETH$/, '');
  const tpOrder = openOrders.find((o: any) => o.type === 'TAKE_PROFIT_MARKET');
  const slOrder = openOrders.find((o: any) => o.type === 'STOP_MARKET');
  const otherOrders = openOrders.filter((o: any) => o.type !== 'TAKE_PROFIT_MARKET' && o.type !== 'STOP_MARKET');

  if (!position) {
    let message = `⚡ **${symbol} - New Position**\n\n`;
    message += `**Exchange:** ${activeExchange.toUpperCase()}\n\n`;
    message += `⚙️ **Trading Settings**\n`;
    message += `• Order Type: ${state.orderType}\n`;
    message += `• Leverage: ${state.leverage}x\n`;
    message += `• Margin: ${state.marginType === 'cross' ? 'Cross' : 'Isolated'}\n\n`;
    
    if (openOrders.length > 0) {
      message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📋 **Open Orders:** ${openOrders.length}\n\n`;
    }

    const firstRow = [
      Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
      Markup.button.callback(`${state.leverage}x`, `pos_leverage_menu:${symbol}`),
    ];

    if (openOrders.length === 0) {
      firstRow.push(Markup.button.callback(`🔄 ${state.marginType.toUpperCase()}`, `pos_toggle_margin:${symbol}`));
    }

    const buttons = [
      firstRow,
      [
        Markup.button.callback('Long $50', `pos_long:${symbol}:50`),
        Markup.button.callback('Long $200', `pos_long:${symbol}:200`),
        Markup.button.callback('Long X', `pos_long_custom:${symbol}`),
      ],
      [
        Markup.button.callback('Short $50', `pos_short:${symbol}:50`),
        Markup.button.callback('Short $200', `pos_short:${symbol}:200`),
        Markup.button.callback('Short X', `pos_short_custom:${symbol}`),
      ],
      [
        Markup.button.callback('« Back', 'menu'),
        Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`),
      ]
    ];
    return { message, buttons };
  }

  // Has position
  const side = parseFloat(position.size) > 0 ? 'LONG 🟢' : 'SHORT 🔴';
  const unrealizedPnl = parseFloat(position.unrealizedPnl);
  const pnlSign = unrealizedPnl >= 0 ? '+' : '';

  let message = `⚡ **Manage ${symbol} Position**\n\n`;
  message += `**Exchange:** ${activeExchange.toUpperCase()}\n`;
  message += `**Side:** ${side}\n`;
  message += `**Size:** ${Math.abs(parseFloat(position.size)).toFixed(4)} ${baseAsset}\n`;
  message += `**PnL:** ${pnlSign}$${unrealizedPnl.toFixed(2)}\n\n`;

  message += '🎯 **TP/SL Status**\n';
  message += `• TP: ${tpOrder ? `$${parseFloat(tpOrder.stopPrice).toFixed(2)} ✅` : '_Not set_ ❌'}\n`;
  message += `• SL: ${slOrder ? `$${parseFloat(slOrder.stopPrice).toFixed(2)} ✅` : '_Not set_ ❌'}\n\n`;

  if (otherOrders.length > 0) {
    message += `📋 **Open Orders (${otherOrders.length})**\n\n`;
  }

  const buttons = [
    [
      Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
      Markup.button.callback(`${state.leverage}x`, `pos_leverage_menu:${symbol}`),
    ],
    [
      Markup.button.callback('Ape $50', `pos_ape:${symbol}:50`),
      Markup.button.callback('Ape $200', `pos_ape:${symbol}:200`),
      Markup.button.callback('Ape X', `pos_ape_custom:${symbol}`),
    ],
    [
      Markup.button.callback('Close All', `pos_close:${symbol}:100`),
      Markup.button.callback('Sell X', `pos_sell_custom:${symbol}`),
    ],
    [
      Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`),
      Markup.button.callback('📋 Orders', `pos_orders_mode:${symbol}`),
    ],
    [
      Markup.button.callback('« Back', 'menu'),
      Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`),
    ],
  ];

  return { message, buttons };
}

export async function buildTPSLButtons(ctx: BotContext, symbol: string): Promise<InlineKeyboardButton[][]> {
  return [
    [
      Markup.button.callback('Set TP', `pos_tpsl_set_tp:${symbol}`),
      Markup.button.callback('Set SL', `pos_tpsl_set_sl:${symbol}`),
    ],
    [
      Markup.button.callback('« Back', `pos_refresh:${symbol}`),
    ],
  ];
}

export async function buildOrdersButtons(ctx: BotContext, symbol: string): Promise<InlineKeyboardButton[][]> {
  return [
    [
      Markup.button.callback('Cancel All', `pos_cancel_all:${symbol}`),
    ],
    [
      Markup.button.callback('« Back', `pos_refresh:${symbol}`),
    ],
  ];
}

export async function showPositionManagement(ctx: BotContext, symbol: string, edit = false): Promise<void> {
  if (!ctx.session.isLinked || !ctx.session.userId) {
    await ctx.reply('❌ You need to link your API first.');
    return;
  }

  try {
    const { message, buttons } = await buildPositionInterface(ctx, symbol);
    
    if (edit && ctx.callbackQuery?.message) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        ctx.callbackQuery.message.message_id,
        undefined,
        message,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } else {
      await cleanupButtonMessages(ctx);
      const sent = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
      trackButtonMessage(ctx, sent.message_id);
    }
  } catch (error: any) {
    console.error('[Position Management] Error:', error);
    await ctx.reply(`❌ Failed to load position: ${error.message}`);
  }
}
