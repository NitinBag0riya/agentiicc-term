/**
 * Position Interface Builders
 *
 * Functions to build UI components for position management
 */
import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { getAsterClientForUser } from '../../aster/helpers';
import { AsterDexError } from '../../aster/client';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';
import { getFuturesTicker } from '../../services/priceCache.service';

/**
 * Fetch and format open orders info (shared helper)
 */
async function getOpenOrdersInfo(client: any, symbol: string) {
  try {
    const openOrders = await client.getOpenOrders(symbol);

    // TP/SL orders are identified by closePosition=true OR reduceOnly=true
    const tpOrder = openOrders.find((o: any) =>
      o.type === 'TAKE_PROFIT_MARKET' && (o.closePosition || o.reduceOnly)
    );
    const slOrder = openOrders.find((o: any) =>
      o.type === 'STOP_MARKET' && (o.closePosition || o.reduceOnly)
    );

    // Other orders = everything that's NOT a TP/SL order
    const otherOrders = openOrders.filter((o: any) => {
      if ((o.type === 'TAKE_PROFIT_MARKET' || o.type === 'STOP_MARKET')
          && (o.closePosition || o.reduceOnly)) {
        return false;
      }
      return true;
    });

    return { openOrders, tpOrder, slOrder, otherOrders };
  } catch (error) {
    console.error('[getOpenOrdersInfo] Error:', error);
    return { openOrders: [], tpOrder: null, slOrder: null, otherOrders: [] };
  }
}

/**
 * Helper to build position management message and buttons
 */
export async function buildPositionInterface(ctx: BotContext, symbol: string, usePlaceholders = false) {
  const redis = getRedis();
  const db = getPostgres();
  const client = await getAsterClientForUser(ctx.session.userId!, db, redis);

  // Get or initialize trading state with placeholders
  if (!ctx.session.tradingState) {
    ctx.session.tradingState = {};
  }
  if (!ctx.session.tradingState[symbol]) {
    ctx.session.tradingState[symbol] = {
      orderType: 'Market',
      leverage: 5, // Default placeholder
      marginType: 'cross', // Default placeholder
    };
  }

  const state = ctx.session.tradingState[symbol];

  // If usePlaceholders=true, return immediately without fetching
  if (usePlaceholders) {
    state.leverage = -1; // Signal to show (?) placeholder
    state.marginType = 'unknown' as any; // Signal to show (??) placeholder
  } else {
    // Fetch actual values from exchange
    const positions = await client.getPositions();
    const positionInfo = positions.find(p => p.symbol === symbol);

    if (positionInfo) {
      // Sync session state with exchange state
      state.leverage = parseInt(positionInfo.leverage);
      state.marginType = positionInfo.marginType.toLowerCase() as 'cross' | 'isolated';
    }
  }

  const position = usePlaceholders ? null : (await client.getPositions()).find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);
  const baseAsset = symbol.replace(/USDT$|USD$|BTC$|ETH$/, '');

  // Fetch orders once (used by both new and existing position views)
  const { openOrders, tpOrder, slOrder, otherOrders } = await getOpenOrdersInfo(client, symbol);

  if (!position) {
    // No position - show new position UI with market data
    let message = `⚡ **${symbol} - New Position**\n\n`;

    // Get current price from cached ticker
    const ticker = getFuturesTicker(symbol);

    if (ticker) {
      const currentPrice = parseFloat(ticker.lastPrice);
      const openPrice = parseFloat(ticker.openPrice);
      const priceChangePercent = parseFloat(ticker.priceChangePercent);
      const priceChange = currentPrice - openPrice;
      const quoteVolume = parseFloat(ticker.quoteVolume);
      const high = parseFloat(ticker.highPrice);
      const low = parseFloat(ticker.lowPrice);

      const changeSign = priceChangePercent >= 0 ? '+' : '';
      const changeEmoji = priceChangePercent >= 0 ? '📈' : '📉';

      message += `${changeEmoji} **Price:** $${currentPrice.toFixed(4)}\n`;
      message += `**24h Change:** ${changeSign}${priceChangePercent.toFixed(2)}% (${changeSign}$${priceChange.toFixed(4)})\n`;
      message += `**24h High/Low:** $${high.toFixed(4)} / $${low.toFixed(4)}\n`;
      message += `**24h Volume:** ${(quoteVolume / 1000000).toFixed(2)}M USDT\n\n`;
    } else {
      message += `_Market data unavailable_\n\n`;
    }

    // Show open orders count if any
    if (openOrders.length > 0) {
      message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📋 **Open Orders:** ${openOrders.length}\n\n`;
    }

    message += `⚙️ **Trading Settings**\n`;
    message += `• Order Type: ${state.orderType}\n`;
    message += `• Leverage: ${state.leverage}x\n`;
    message += `• Margin: ${state.marginType === 'cross' ? 'Cross' : 'Isolated'}\n\n`;
    message += `_Ready to open a position?_`;

    // First row: Order type, Leverage, and Margin type (if no open orders)
    const leverageLabel = state.leverage === -1 ? '(?x)' : `${state.leverage}x`;
    const marginLabel = state.marginType === 'unknown'
      ? '(??)'
      : `🔄 ${state.marginType === 'cross' ? 'Cross' : 'Isolated'}`;

    const firstRow = [
      Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
      Markup.button.callback(leverageLabel, `pos_leverage_menu:${symbol}`),
    ];

    // Only show margin type flipper if there are NO open orders/positions
    if (openOrders.length === 0) {
      firstRow.push(
        Markup.button.callback(marginLabel, `pos_toggle_margin:${symbol}`)
      );
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
        Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`),
      ],
    ];

    // Add Manage Orders button if there are orders
    if (openOrders.length > 0) {
      buttons.push([
        Markup.button.callback(`📋 Manage Orders (${openOrders.length})`, `pos_manage_orders:${symbol}`),
      ]);
    }

    buttons.push([
      Markup.button.callback('« Back to Menu', 'menu'),
      Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`),
    ]);

    return { message, buttons };
  }

  // Has position - show position management UI with TP/SL and orders info
  const positionAmt = parseFloat(position.positionAmt);
  const side = positionAmt > 0 ? 'LONG 🟢' : 'SHORT 🔴';
  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = parseFloat(position.markPrice);
  const unrealizedPnl = parseFloat(position.unRealizedProfit);
  const pnlSign = unrealizedPnl >= 0 ? '+' : '';

  // Calculate ROE (Return on Equity) - PnL % based on margin, not price change
  const leverage = parseFloat(position.leverage);
  const notional = Math.abs(parseFloat(position.notional));
  const margin = notional / leverage;
  const roe = (unrealizedPnl / margin) * 100;
  const roeSign = roe >= 0 ? '+' : '';

  let message = `⚡ **Manage ${symbol} Position**\n\n`;
  const positionValueUsdt = Math.abs(positionAmt) * markPrice;
  message += `**Current:** $${positionValueUsdt.toFixed(2)} (${Math.abs(positionAmt).toFixed(2)} ${baseAsset}) @ $${entryPrice.toFixed(4)} ${side}\n`;
  message += `**PnL:** ${pnlSign}$${unrealizedPnl.toFixed(2)} (${roeSign}${roe.toFixed(2)}%)\n`;
  message += `**Mark Price:** $${markPrice.toFixed(4)}\n`;

  // Display TP/SL info (already fetched above)
  message += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
  message += '🎯 **TP/SL Status**\n\n';

  if (tpOrder) {
    const tpPrice = parseFloat(tpOrder.stopPrice || '0');
    const tpPercent = ((tpPrice - entryPrice) / entryPrice) * 100;
    const tpSign = tpPercent >= 0 ? '+' : '';
    message += `**TP:** $${tpPrice.toFixed(2)} (${tpSign}${tpPercent.toFixed(1)}%)\n`;
  } else {
    message += `**TP:** _Not set_ ❌\n`;
  }

  if (slOrder) {
    const slPrice = parseFloat(slOrder.stopPrice || '0');
    const slPercent = ((slPrice - entryPrice) / entryPrice) * 100;
    const slSign = slPercent >= 0 ? '+' : '';
    message += `**SL:** $${slPrice.toFixed(2)} (${slSign}${slPercent.toFixed(1)}%)\n`;
  } else {
    message += `**SL:** _Not set_ ❌\n`;
  }

  if (otherOrders.length > 0) {
    message += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
    message += `📋 **Open Orders (${otherOrders.length})**\n\n`;
    otherOrders.slice(0, 3).forEach((order, idx) => {
        const sideText = order.side === 'BUY' ? 'Buy' : 'Sell';

        // Format order type for readability
        // Note: "STOP" in Binance is actually "Stop-Limit" (has both trigger and execution price)
        let typeFormatted = order.type
          .split('_')
          .map(word => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' ');

        // Fix "Stop" to "Stop Limit" since it has an execution price
        if (order.type === 'STOP') {
          typeFormatted = 'Stop Limit';
        }

        // Determine trigger condition symbol (>=, <=)
        let triggerSymbol = '';
        if (order.type.includes('STOP') && !order.type.includes('TAKE_PROFIT')) {
          // STOP orders: SELL triggers when <= (going down), BUY triggers when >= (going up)
          triggerSymbol = order.side === 'SELL' ? '≤' : '≥';
        } else if (order.type.includes('TAKE_PROFIT')) {
          // TAKE_PROFIT orders: opposite of STOP
          triggerSymbol = order.side === 'SELL' ? '≥' : '≤';
        }

        // Build order condition string with all details
        const qty = order.closePosition ? 'All' : order.origQty;
        const workingPrice = order.workingType === 'MARK_PRICE' ? 'Mark Price' : 'Last Price';

        // Add reduce only flag if set
        const reduceOnlyTag = order.reduceOnly ? ' [Reduce Only]' : '';

        let conditionStr = '';

        if (order.type === 'LIMIT') {
          const usdtValue = (parseFloat(qty) * parseFloat(order.price)).toFixed(2);
          conditionStr = `${qty} @ $${parseFloat(order.price || '0').toFixed(2)} (${usdtValue} USDT)`;
          // Add time in force for limit orders
          if (order.timeInForce && order.timeInForce !== 'GTC') {
            conditionStr += ` [${order.timeInForce}]`;
          }
        } else if (order.type === 'STOP_LIMIT' || order.type === 'STOP') {
          // Both have trigger and execution price
          const limitPrice = parseFloat(order.price || '0').toFixed(2);
          const usdtValue = (parseFloat(qty) * parseFloat(order.price || '0')).toFixed(2);
          conditionStr = `Size: ${usdtValue} USDT\n   Trigger: ${workingPrice} ${triggerSymbol} $${parseFloat(order.stopPrice || '0').toFixed(2)} → @ $${limitPrice}`;
        } else if (order.type === 'STOP_MARKET' || order.type === 'TAKE_PROFIT_MARKET') {
          // Show size for regular TP/STOP orders (not position closers)
          if (!order.closePosition && qty !== 'All') {
            const usdtValue = (parseFloat(qty) * markPrice).toFixed(2);
            conditionStr = `Size: $${usdtValue} (${qty} ${baseAsset})\n   `;
          }
          conditionStr += `Trigger: ${workingPrice} ${triggerSymbol} $${parseFloat(order.stopPrice || '0').toFixed(2)} → Market`;
          if (order.closePosition) {
            conditionStr += ' (Close All)';
          }
        } else if (order.type === 'TRAILING_STOP_MARKET') {
          const activationPrice = order.activatePrice ? ` starts @ $${parseFloat(order.activatePrice).toFixed(2)}` : '';
          conditionStr = `Trail ${order.priceRate || ''}%${activationPrice}`;
        } else {
          // Fallback for other order types
          const price = order.price || order.stopPrice || '0';
          conditionStr = `${qty} @ $${parseFloat(price).toFixed(2)}`;
        }

        // Add order creation time (format: Oct 4, 14:30)
        const orderTime = new Date(order.time);
        const month = orderTime.toLocaleString('en-US', { month: 'short' });
        const day = orderTime.getDate();
        const hours = orderTime.getHours().toString().padStart(2, '0');
        const minutes = orderTime.getMinutes().toString().padStart(2, '0');
        const timeStr = `${month} ${day}, ${hours}:${minutes}`;

        message += `${idx + 1}. ${sideText} ${typeFormatted}${reduceOnlyTag} (${timeStr})\n`;
        message += `   ${conditionStr}\n`;
      });
      if (otherOrders.length > 3) {
        message += `\n_+${otherOrders.length - 3} more..._\n`;
      }
    }

  message += '\n';

  // Build close row - margin button only for isolated mode with open position
  const closeRow = state.marginType === 'isolated'
    ? [
        Markup.button.callback('Close All', `pos_close:${symbol}:100`),
        Markup.button.callback('🛠️ Margin', `pos_margin:${symbol}`),
      ]
    : [
        Markup.button.callback('Close All', `pos_close:${symbol}:100`),
      ];

  // First row: Order type, Leverage (margin type flipper hidden when position exists)
  const leverageLabel = state.leverage === -1 ? '(?x)' : `${state.leverage}x`;

  const firstRow = [
    Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
    Markup.button.callback(leverageLabel, `pos_leverage_menu:${symbol}`),
  ];

  // Don't show margin type flipper when there's an active position or open orders
  // (can't change margin type with open position/orders)

  const buttons = [
    firstRow,
    [
      Markup.button.callback('Ape $50', `pos_ape:${symbol}:50`),
      Markup.button.callback('Ape $200', `pos_ape:${symbol}:200`),
      Markup.button.callback('Ape X', `pos_ape_custom:${symbol}`),
    ],
    closeRow,
    [
      Markup.button.callback('Sell 25%', `pos_close:${symbol}:25`),
      Markup.button.callback('Sell 69%', `pos_close:${symbol}:69`),
      Markup.button.callback('Sell X', `pos_sell_custom:${symbol}`),
    ],
    [
      Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`),
      Markup.button.callback('📋 Manage Orders', `pos_orders_mode:${symbol}`),
    ],
    [
      Markup.button.callback('« Back to Menu', 'menu'),
      Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`),
    ],
  ];

  return { message, buttons };
}

/**
 * Build TP/SL mode buttons
 */
export async function buildTPSLButtons(ctx: BotContext, symbol: string): Promise<InlineKeyboardButton[][]> {
  const redis = getRedis();
  const db = getPostgres();
  const client = await getAsterClientForUser(ctx.session.userId!, db, redis);

  const openOrders = await client.getOpenOrders(symbol);
  const tpOrder = openOrders.find(o => o.type === 'TAKE_PROFIT_MARKET');
  const slOrder = openOrders.find(o => o.type === 'STOP_MARKET');

  const buttons = [];

  if (tpOrder && slOrder) {
    buttons.push([
      Markup.button.callback('Modify TP', `pos_tpsl_modify_tp:${symbol}`),
      Markup.button.callback('Modify SL', `pos_tpsl_modify_sl:${symbol}`),
    ]);
    buttons.push([
      Markup.button.callback('Remove TP', `pos_tpsl_remove_tp:${symbol}:${tpOrder.orderId}`),
      Markup.button.callback('Remove SL', `pos_tpsl_remove_sl:${symbol}:${slOrder.orderId}`),
    ]);
  } else if (tpOrder) {
    buttons.push([
      Markup.button.callback('Set SL', `pos_tpsl_set_sl:${symbol}`),
      Markup.button.callback('Modify TP', `pos_tpsl_modify_tp:${symbol}`),
    ]);
    buttons.push([
      Markup.button.callback('Remove TP', `pos_tpsl_remove_tp:${symbol}:${tpOrder.orderId}`),
    ]);
  } else if (slOrder) {
    buttons.push([
      Markup.button.callback('Set TP', `pos_tpsl_set_tp:${symbol}`),
      Markup.button.callback('Modify SL', `pos_tpsl_modify_sl:${symbol}`),
    ]);
    buttons.push([
      Markup.button.callback('Remove SL', `pos_tpsl_remove_sl:${symbol}:${slOrder.orderId}`),
    ]);
  } else {
    buttons.push([
      Markup.button.callback('Set TP', `pos_tpsl_set_tp:${symbol}`),
      Markup.button.callback('Set SL', `pos_tpsl_set_sl:${symbol}`),
    ]);
    buttons.push([
      Markup.button.callback('Set Both', `pos_tpsl_set_both:${symbol}`),
    ]);
  }

  buttons.push([
    Markup.button.callback('« Back', `pos_refresh:${symbol}`),
  ]);

  return buttons;
}

/**
 * Build Orders mode buttons
 */
export async function buildOrdersButtons(ctx: BotContext, symbol: string): Promise<InlineKeyboardButton[][]> {
  return [
    [
      Markup.button.callback('Cancel All', `pos_cancel_all:${symbol}`),
      Markup.button.callback('Cancel X', `pos_cancel_custom:${symbol}`),
    ],
    [
      Markup.button.callback('« Back', `pos_refresh:${symbol}`),
    ],
  ];
}

/**
 * Show position management interface
 */
export async function showPositionManagement(ctx: BotContext, symbol: string, edit = false): Promise<void> {
  if (!ctx.session.isLinked || !ctx.session.userId) {
    await ctx.reply('❌ You need to link your API first.\n\nUse /link to get started.', {
      parse_mode: 'Markdown',
    });
    return;
  }

  try {
    const existingMessageId = ctx.session.tradingState?.[symbol]?.messageId;

    // Step 1: Show interface with placeholders immediately
    const { message: placeholderMessage, buttons: placeholderButtons } = await buildPositionInterface(ctx, symbol, true);

    let messageId: number;

    if (edit && existingMessageId) {
      // Edit existing message with placeholders
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        existingMessageId,
        undefined,
        placeholderMessage,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(placeholderButtons),
        }
      );
      messageId = existingMessageId;
    } else {
      // Clean up old button messages first
      await cleanupButtonMessages(ctx);

      // Send new message with placeholders
      const sentMessage = await ctx.reply(placeholderMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(placeholderButtons),
      });

      messageId = sentMessage.message_id;

      // Store message ID for future edits
      if (!ctx.session.tradingState) ctx.session.tradingState = {};
      if (!ctx.session.tradingState[symbol]) {
        ctx.session.tradingState[symbol] = {
          orderType: 'Market',
          leverage: 5,
          marginType: 'cross',
        };
      }
      ctx.session.tradingState[symbol].messageId = messageId;

      // Track this message for future cleanup
      trackButtonMessage(ctx, messageId);
    }

    // Step 2: Fetch actual data in background and update
    const { message: actualMessage, buttons: actualButtons } = await buildPositionInterface(ctx, symbol, false);

    // Step 3: Update with actual data
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      messageId,
      undefined,
      actualMessage,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(actualButtons),
      }
    );

  } catch (error: unknown) {
    console.error('[Position Management] Error:', error);

    let errorMessage = '❌ **Failed to Load Position**\n\n';
    if (error instanceof AsterDexError) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unexpected error occurred.';
    }

    await ctx.reply(errorMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
    });
  }
}
