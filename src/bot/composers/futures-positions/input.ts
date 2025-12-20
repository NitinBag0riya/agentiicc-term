/**
 * Text Input Middleware
 *
 * Handles user text input for: leverage, cancel orders, TP/SL
 * (Trading input now handled by wizard scenes in trade.scene.ts)
 */
import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../../types/context';
import { UniversalApiService } from '../../services/universal-api.service';
import { showPositionManagement } from './interface';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';

/**
 * Register text input middleware handler
 */
export function registerTextInputHandler(composer: Composer<BotContext>) {
  composer.use(async (ctx, next) => {
    // Only handle text messages when waiting for input
    if (ctx.message && 'text' in ctx.message && ctx.session.waitingForInput) {
      const input = ctx.message.text.trim();

      // IMPORTANT: Let commands pass through! Don't intercept /menu, /start, etc
      if (input.startsWith('/')) {
        ctx.session.waitingForInput = undefined; // Clear state
        return next(); // Pass to command handler
      }

      const { action, symbol } = ctx.session.waitingForInput;

      if (action === 'cancel_custom') {
        await handleCancelCustomInput(ctx, symbol, input);
      } else if (action === 'tpsl_set_tp' || action === 'tpsl_modify_tp') {
        await handleTPSLSetTP(ctx, symbol, input, action);
      } else if (action === 'tpsl_set_sl' || action === 'tpsl_modify_sl') {
        await handleTPSLSetSL(ctx, symbol, input, action);
      } else if (action === 'tpsl_set_both') {
        await handleTPSLSetBoth(ctx, symbol, input);
      }
    } else {
      // Not handling this text, pass to next middleware
      return next();
    }
  });
}

/**
 * Handle Cancel Custom Orders Input
 */
async function handleCancelCustomInput(ctx: BotContext, symbol: string, input: string) {
  const indices = input.split(',').map(idx => parseInt(idx.trim()) - 1).filter(idx => !isNaN(idx));

  if (indices.length === 0) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to order management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid order number(s). Please try again.\n\nFormat: Enter order numbers separated by commas\nExample: 1,2,3`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  const openOrders = ctx.session.tradingState?.[symbol]?.openOrders || [];
  const validOrders: Array<{ index: number; orderId: number; type?: string }> = [];
  const invalidIndices: number[] = [];

  indices.forEach(idx => {
    if (idx >= 0 && idx < openOrders.length) {
      validOrders.push({ index: idx + 1, orderId: openOrders[idx].orderId, type: openOrders[idx].type });
    } else {
      invalidIndices.push(idx + 1);
    }
  });

  if (validOrders.length === 0) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to order management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ No valid order numbers found. Please try again.\n\nMake sure to use numbers from the order list.\nExample: If you see orders 1, 2, 3, enter: 1,2`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  ctx.session.waitingForInput = undefined;

  const userId = ctx.session.userId?.toString();
  const exchange = ctx.session.activeExchange;
  if (!userId || !exchange) return;

  try {
    await ctx.reply(`⏳ Cancelling ${validOrders.length} order(s)...`);
    
    for (const order of validOrders) {
      await UniversalApiService.cancelOrder(userId, exchange, order.orderId.toString());
    }

    await ctx.reply(`✅ Successfully cancelled ${validOrders.length} order(s)!`);
    
    if (invalidIndices.length > 0) {
      await ctx.reply(`⚠️ Skipped invalid indices: ${invalidIndices.join(', ')}`);
    }
    
    await showPositionManagement(ctx, symbol, false);
  } catch (error) {
    console.error('[Cancel Custom] Error:', error);
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('❌ Failed to cancel orders', {
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  }
}

/**
 * Handle TP/SL Set/Modify TP Input
 */
async function handleTPSLSetTP(ctx: BotContext, symbol: string, input: string, action: string) {
  const isPercentage = input.trim().endsWith('%');
  const numericValue = parseFloat(input.replace('%', '').trim());

  if (isNaN(numericValue) || numericValue <= 0) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to position management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid price. Please try again.\n\nExamples:\n• $2500 → Take profit at $2500\n• 5% → Take profit 5% above entry`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  ctx.session.waitingForInput = undefined;

  const userId = ctx.session.userId?.toString();
  const exchange = ctx.session.activeExchange;
  if (!userId || !exchange) return;

  try {
    const positions = await UniversalApiService.getPositions(userId, exchange);
    const position = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt || p.size) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt || position.size);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY';

    let price: number;
    if (isPercentage) {
      const multiplier = side === 'SELL' ? (1 + numericValue / 100) : (1 - numericValue / 100);
      price = entryPrice * multiplier;
    } else {
      price = numericValue;
    }

    if (action === 'tpsl_modify_tp') {
      const openOrders = await UniversalApiService.getOpenOrders(userId, exchange, symbol);
      const tpOrder = openOrders.find((o: any) => o.type === 'TAKE_PROFIT_MARKET');
      if (tpOrder) {
        await UniversalApiService.cancelOrder(userId, exchange, tpOrder.orderId);
      }
    }

    const actionLabel = isPercentage
      ? `${action === 'tpsl_modify_tp' ? 'Modify' : 'Set'} TP at +${numericValue}% ($${price.toFixed(4)})`
      : `${action === 'tpsl_modify_tp' ? 'Modify' : 'Set'} TP at $${price.toFixed(4)}`;

    await ctx.reply(`⏳ ${actionLabel}...`);
    await UniversalApiService.placeOrder(userId, {
      exchange,
      symbol,
      side,
      type: 'TAKE_PROFIT_MARKET',
      triggerPrice: price.toString(),
      reduceOnly: true,
    });
    await ctx.reply(`✅ ${actionLabel} successful!`);
    await showPositionManagement(ctx, symbol, false);
  } catch (error) {
    console.error('[Set TP] Error:', error);
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('❌ Failed to set Take Profit', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  }
}

/**
 * Handle TP/SL Set/Modify SL Input
 */
async function handleTPSLSetSL(ctx: BotContext, symbol: string, input: string, action: string) {
  const isPercentage = input.trim().endsWith('%');
  const numericValue = parseFloat(input.replace('%', '').trim());

  if (isNaN(numericValue) || numericValue <= 0) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to position management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid price. Please try again.\n\nExamples:\n• $1800 → Stop loss at $1800\n• 3% → Stop loss 3% below entry`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  ctx.session.waitingForInput = undefined;

  const userId = ctx.session.userId?.toString();
  const exchange = ctx.session.activeExchange;
  if (!userId || !exchange) return;

  try {
    const positions = await UniversalApiService.getPositions(userId, exchange);
    const position = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt || p.size) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt || position.size);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY';

    let price: number;
    if (isPercentage) {
      const multiplier = side === 'SELL' ? (1 - numericValue / 100) : (1 + numericValue / 100);
      price = entryPrice * multiplier;
    } else {
      price = numericValue;
    }

    if (action === 'tpsl_modify_sl') {
      const openOrders = await UniversalApiService.getOpenOrders(userId, exchange, symbol);
      const slOrder = openOrders.find((o: any) => o.type === 'STOP_MARKET');
      if (slOrder) {
        await UniversalApiService.cancelOrder(userId, exchange, slOrder.orderId);
      }
    }

    const actionLabel = isPercentage
      ? `${action === 'tpsl_modify_sl' ? 'Modify' : 'Set'} SL at -${numericValue}% ($${price.toFixed(4)})`
      : `${action === 'tpsl_modify_sl' ? 'Modify' : 'Set'} SL at $${price.toFixed(4)}`;

    await ctx.reply(`⏳ ${actionLabel}...`);
    await UniversalApiService.placeOrder(userId, {
      exchange,
      symbol,
      side,
      type: 'STOP_MARKET',
      triggerPrice: price.toString(),
      reduceOnly: true,
    });
    await ctx.reply(`✅ ${actionLabel} successful!`);
    await showPositionManagement(ctx, symbol, false);
  } catch (error) {
    console.error('[Set SL] Error:', error);
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('❌ Failed to set Stop Loss', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  }
}

/**
 * Handle TP/SL Set Both Input
 */
async function handleTPSLSetBoth(ctx: BotContext, symbol: string, input: string) {
  const inputs = input.split(/\s+/);

  if (inputs.length !== 2) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to position management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Please enter both TP and SL separated by space.\n\nFormat: TP SL\nExample: $2500 $1800\nExample: 5% 3%`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  const tpIsPercentage = inputs[0].trim().endsWith('%');
  const tpValue = parseFloat(inputs[0].replace('%', '').trim());

  const slIsPercentage = inputs[1].trim().endsWith('%');
  const slValue = parseFloat(inputs[1].replace('%', '').trim());

  if (isNaN(tpValue) || tpValue <= 0 || isNaN(slValue) || slValue <= 0) {
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      ctx.session.waitingForInput = undefined;
      await ctx.reply('⚠️ **Too many invalid attempts**\n\nReturning to position management...', { parse_mode: 'Markdown' });
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid values. Please try again.\n\nExamples:\n• $2500 $1800 → TP at $2500, SL at $1800\n• 5% 3% → TP +5%, SL -3%`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]) }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  ctx.session.waitingForInput = undefined;

  const userId = ctx.session.userId?.toString();
  const exchange = ctx.session.activeExchange;
  if (!userId || !exchange) return;

  try {
    const positions = await UniversalApiService.getPositions(userId, exchange);
    const position = positions.find((p: any) => p.symbol === symbol && parseFloat(p.positionAmt || p.size) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt || position.size);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY';

    let tpPrice: number;
    if (tpIsPercentage) {
      const multiplier = side === 'SELL' ? (1 + tpValue / 100) : (1 - tpValue / 100);
      tpPrice = entryPrice * multiplier;
    } else {
      tpPrice = tpValue;
    }

    let slPrice: number;
    if (slIsPercentage) {
      const multiplier = side === 'SELL' ? (1 - slValue / 100) : (1 + slValue / 100);
      slPrice = entryPrice * multiplier;
    } else {
      slPrice = slValue;
    }

    const tpLabel = tpIsPercentage
      ? `+${tpValue}% ($${tpPrice.toFixed(4)})`
      : `$${tpPrice.toFixed(4)}`;
    const slLabel = slIsPercentage
      ? `-${slValue}% ($${slPrice.toFixed(4)})`
      : `$${slPrice.toFixed(4)}`;

    await ctx.reply(`⏳ Setting TP ${tpLabel} & SL ${slLabel}...`);
    
    await UniversalApiService.placeOrder(userId, {
      exchange,
      symbol,
      side,
      type: 'TAKE_PROFIT_MARKET',
      triggerPrice: tpPrice.toString(),
      reduceOnly: true,
    });

    await UniversalApiService.placeOrder(userId, {
      exchange,
      symbol,
      side,
      type: 'STOP_MARKET',
      triggerPrice: slPrice.toString(),
      reduceOnly: true,
    });

    await ctx.reply(`✅ TP & SL set successfully!`);
    await showPositionManagement(ctx, symbol, false);
  } catch (error) {
    console.error('[Set Both TP/SL] Error:', error);
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('❌ Failed to set TP/SL', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  }
}
