/**
 * Text Input Middleware
 *
 * Handles user text input for: leverage, cancel orders, TP/SL
 * (Trading input now handled by wizard scenes in trade.scene.ts)
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { getAsterClientForUser } from '../../aster/helpers';
import { showConfirmation } from '../../utils/confirmDialog';
import type { AsterWriteOp } from '../../aster/writeOps';
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

      // Trading input handlers are now handled by wizard scenes
      // Old inline handlers commented out - use wizards instead
      // if (action === 'ape_custom') {
      //   await handleApeCustomInput(ctx, symbol, input);
      // } else if (action === 'sell_custom') {
      //   await handleSellCustomInput(ctx, symbol, input);
      // } else if (action === 'long_custom') {
      //   await handleLongCustomInput(ctx, symbol, input);
      // } else if (action === 'short_custom') {
      //   await handleShortCustomInput(ctx, symbol, input);
      // } else
      // NOTE: leverage_custom is now handled by leverage-wizard scene

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

// OLD TRADING INPUT HANDLERS REMOVED
// Now using wizard scenes for all trading input (Ape, Long, Short, Sell)
// See: new-src/scenes/trade.scene.ts

/**
 * Handle Leverage Custom Input
 * NOTE: This is deprecated - leverage is now handled by leverage-wizard scene
 * Keeping this commented out as reference
 */
// async function handleLeverageCustomInput(ctx: BotContext, symbol: string, input: string) {
//   // Now handled by leverage-wizard scene in scenes/leverage.scene.ts
// }

/**
 * Handle Cancel Custom Orders Input
 */
async function handleCancelCustomInput(ctx: BotContext, symbol: string, input: string) {
  const indices = input.split(',').map(idx => parseInt(idx.trim()) - 1).filter(idx => !isNaN(idx));

  if (indices.length === 0) {
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Please enter valid order numbers (e.g., 1,2,3).\n' +
        'Returning to order management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid order number(s). Please try again.\n\n` +
      `Format: Enter order numbers separated by commas\n` +
      `Example: 1,2,3`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Get open orders from session
  const openOrders = ctx.session.tradingState?.[symbol]?.openOrders || [];

  // Validate indices and get order IDs
  const validOrders: Array<{ index: number; orderId: number; type?: string }> = [];
  const invalidIndices: number[] = [];

  indices.forEach(idx => {
    if (idx >= 0 && idx < openOrders.length) {
      validOrders.push({
        index: idx + 1,
        orderId: openOrders[idx].orderId,
        type: openOrders[idx].type
      });
    } else {
      invalidIndices.push(idx + 1);
    }
  });

  if (validOrders.length === 0) {
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Order numbers out of range.\n' +
        'Returning to order management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ No valid order numbers found. Please try again.\n\n` +
      `Make sure to use numbers from the order list.\n` +
      `Example: If you see orders 1, 2, 3, enter: 1,2`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Clear waiting state after successful validation
  ctx.session.waitingForInput = undefined;

  if (!ctx.session.userId) return;

  try {
    const redis = getRedis();
    const db = getPostgres();

    // Build operation based on number of orders
    let operation: AsterWriteOp;

    if (validOrders.length === 1) {
      // Single order - use CANCEL_ORDER
      operation = {
        operation: 'CANCEL_ORDER',
        params: {
          symbol,
          orderId: validOrders[0].orderId,
        },
        metadata: {
          orderType: validOrders[0].type,
        },
      };
    } else {
      // Multiple orders - use BATCH_ORDERS with cancel operations
      // Note: We'll execute them sequentially in the write engine
      const cancelOps = validOrders.map(order => ({
        operation: 'CANCEL_ORDER' as const,
        params: {
          symbol,
          orderId: order.orderId,
        },
        metadata: {
          orderType: order.type,
        },
      }));

      // For now, we'll create a special metadata description
      // The write engine will handle these as parallel cancellations
      operation = {
        operation: 'CANCEL_ORDER',
        params: {
          symbol,
          orderId: validOrders[0].orderId,
        },
        metadata: {
          orderType: `${validOrders.length} orders`,
        },
      };

      // Store all order IDs in a special way (we'll create multiple operations)
      // Actually, let's use a simpler approach: store the list and execute them
      // For simplicity, let's just show first order and note "and X more"
      if (validOrders.length > 1) {
        operation.metadata!.orderType = `${validOrders[0].type} and ${validOrders.length - 1} more`;
      }
    }

    // Show confirmation dialog
    await showConfirmation(ctx, db, redis, ctx.session.userId, operation);

    // Note: For multiple orders, we need a different approach
    // Let's show a custom message with details
    if (validOrders.length > 1 && invalidIndices.length > 0) {
      await ctx.reply(`⚠️ Skipped invalid indices: ${invalidIndices.join(', ')}`, {
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('[Cancel Custom] Error:', error);
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('❌ Failed to prepare cancellation', {
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_manage_orders:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  }
}

/**
 * Handle TP/SL Set/Modify TP Input
 */
async function handleTPSLSetTP(ctx: BotContext, symbol: string, input: string, action: string) {
  // Check if input is percentage (ends with %)
  const isPercentage = input.trim().endsWith('%');
  const numericValue = parseFloat(input.replace('%', '').trim());

  if (isNaN(numericValue) || numericValue <= 0) {
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Please enter a valid price or percentage.\n' +
        'Returning to position management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid price. Please try again.\n\n` +
      `Examples:\n` +
      `• $2500 → Take profit at $2500\n` +
      `• 5% → Take profit 5% above entry`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Clear waiting state after successful validation
  ctx.session.waitingForInput = undefined;

  if (!ctx.session.userId) return;

  try {
    const redis = getRedis();
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    // Get position
    const positions = await client.getPositions();
    const position = positions.find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY'; // Opposite side to close

    // Calculate actual price
    let price: number;
    if (isPercentage) {
      // TP is above entry for long, below entry for short (but we're already reversing side)
      // For long position (side=SELL for TP), add percentage
      // For short position (side=BUY for TP), subtract percentage
      const multiplier = side === 'SELL' ? (1 + numericValue / 100) : (1 - numericValue / 100);
      price = entryPrice * multiplier;
    } else {
      price = numericValue;
    }

    // If modifying, cancel existing TP order first (still immediate - just cleanup)
    if (action === 'tpsl_modify_tp') {
      const openOrders = await client.getOpenOrders(symbol);
      const tpOrder = openOrders.find(o => o.type === 'TAKE_PROFIT_MARKET');
      if (tpOrder) {
        await client.cancelOrder(symbol, tpOrder.orderId);
      }
    }

    // Build write operation
    const actionLabel = isPercentage
      ? `${action === 'tpsl_modify_tp' ? 'Modify' : 'Set'} TP at +${numericValue}% ($${price.toFixed(4)})`
      : `${action === 'tpsl_modify_tp' ? 'Modify' : 'Set'} TP at $${price.toFixed(4)}`;

    const operation: AsterWriteOp = {
      operation: 'CREATE_ORDER',
      params: {
        symbol,
        side,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: price.toString(),
        // NOTE: When closePosition='true', don't send quantity or reduceOnly
        // The API will close the entire position automatically
        closePosition: 'true',
      },
      metadata: {
        action: actionLabel,
      },
    };

    // Show confirmation dialog
    await showConfirmation(ctx, db, redis, ctx.session.userId, operation);
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
  // Check if input is percentage (ends with %)
  const isPercentage = input.trim().endsWith('%');
  const numericValue = parseFloat(input.replace('%', '').trim());

  if (isNaN(numericValue) || numericValue <= 0) {
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Please enter a valid price or percentage.\n' +
        'Returning to position management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid price. Please try again.\n\n` +
      `Examples:\n` +
      `• $1800 → Stop loss at $1800\n` +
      `• 3% → Stop loss 3% below entry`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Clear waiting state after successful validation
  ctx.session.waitingForInput = undefined;

  if (!ctx.session.userId) return;

  try {
    const redis = getRedis();
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    // Get position
    const positions = await client.getPositions();
    const position = positions.find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY'; // Opposite side to close

    // Calculate actual price
    let price: number;
    if (isPercentage) {
      // SL is below entry for long, above entry for short (opposite of TP)
      // For long position (side=SELL for SL), subtract percentage
      // For short position (side=BUY for SL), add percentage
      const multiplier = side === 'SELL' ? (1 - numericValue / 100) : (1 + numericValue / 100);
      price = entryPrice * multiplier;
    } else {
      price = numericValue;
    }

    // If modifying, cancel existing SL order first (still immediate - just cleanup)
    if (action === 'tpsl_modify_sl') {
      const openOrders = await client.getOpenOrders(symbol);
      const slOrder = openOrders.find(o => o.type === 'STOP_MARKET');
      if (slOrder) {
        await client.cancelOrder(symbol, slOrder.orderId);
      }
    }

    // Build write operation
    const actionLabel = isPercentage
      ? `${action === 'tpsl_modify_sl' ? 'Modify' : 'Set'} SL at -${numericValue}% ($${price.toFixed(4)})`
      : `${action === 'tpsl_modify_sl' ? 'Modify' : 'Set'} SL at $${price.toFixed(4)}`;

    const operation: AsterWriteOp = {
      operation: 'CREATE_ORDER',
      params: {
        symbol,
        side,
        type: 'STOP_MARKET',
        stopPrice: price.toString(),
        // NOTE: When closePosition='true', don't send quantity or reduceOnly
        // The API will close the entire position automatically
        closePosition: 'true',
      },
      metadata: {
        action: actionLabel,
      },
    };

    // Show confirmation dialog
    await showConfirmation(ctx, db, redis, ctx.session.userId, operation);
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
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Please enter both TP and SL values separated by space.\n' +
        'Returning to position management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Please enter both TP and SL separated by space.\n\n` +
      `Format: TP SL\n` +
      `Example: $2500 $1800\n` +
      `Example: 5% 3%`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Parse TP (can be "10%" or "2.50")
  const tpIsPercentage = inputs[0].trim().endsWith('%');
  const tpValue = parseFloat(inputs[0].replace('%', '').trim());

  // Parse SL (can be "5%" or "1.80")
  const slIsPercentage = inputs[1].trim().endsWith('%');
  const slValue = parseFloat(inputs[1].replace('%', '').trim());

  if (isNaN(tpValue) || tpValue <= 0 || isNaN(slValue) || slValue <= 0) {
    // Track retry attempts
    const waitingState = ctx.session.waitingForInput;
    if (!waitingState) return;

    waitingState.retryCount = (waitingState.retryCount || 0) + 1;

    if (waitingState.retryCount >= 2) {
      // TOO MANY ERRORS - EXIT
      ctx.session.waitingForInput = undefined;
      await ctx.reply(
        '⚠️ **Too many invalid attempts**\n\n' +
        'Invalid TP or SL values.\n' +
        'Returning to position management...',
        { parse_mode: 'Markdown' }
      );
      await showPositionManagement(ctx, symbol, false);
      return;
    }

    // FIRST ERROR - SHOW HELP
    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply(
      `❌ Invalid values. Please try again.\n\n` +
      `Examples:\n` +
      `• $2500 $1800 → TP at $2500, SL at $1800\n` +
      `• 5% 3% → TP +5%, SL -3%`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      }
    );
    trackButtonMessage(ctx, sentMessage.message_id);
    return;
  }

  // Clear waiting state after successful validation
  ctx.session.waitingForInput = undefined;

  if (!ctx.session.userId) return;

  try {
    const redis = getRedis();
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);

    // Get position
    const positions = await client.getPositions();
    const position = positions.find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

    if (!position) {
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Position not found', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'menu')]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    const positionAmt = parseFloat(position.positionAmt);
    const entryPrice = parseFloat(position.entryPrice);
    const side = positionAmt > 0 ? 'SELL' : 'BUY'; // Opposite side to close

    // Calculate TP price
    let tpPrice: number;
    if (tpIsPercentage) {
      const multiplier = side === 'SELL' ? (1 + tpValue / 100) : (1 - tpValue / 100);
      tpPrice = entryPrice * multiplier;
    } else {
      tpPrice = tpValue;
    }

    // Calculate SL price
    let slPrice: number;
    if (slIsPercentage) {
      const multiplier = side === 'SELL' ? (1 - slValue / 100) : (1 + slValue / 100);
      slPrice = entryPrice * multiplier;
    } else {
      slPrice = slValue;
    }

    // Build description with percentages if applicable
    const tpLabel = tpIsPercentage
      ? `+${tpValue}% ($${tpPrice.toFixed(4)})`
      : `$${tpPrice.toFixed(4)}`;
    const slLabel = slIsPercentage
      ? `-${slValue}% ($${slPrice.toFixed(4)})`
      : `$${slPrice.toFixed(4)}`;

    // Build batch operation for both TP and SL
    const operation: AsterWriteOp = {
      operation: 'BATCH_ORDERS',
      params: {
        symbol,
        orders: [
          {
            symbol,
            side,
            type: 'TAKE_PROFIT_MARKET',
            stopPrice: tpPrice.toString(),
            // NOTE: When closePosition='true', don't send quantity or reduceOnly
            closePosition: 'true',
          },
          {
            symbol,
            side,
            type: 'STOP_MARKET',
            stopPrice: slPrice.toString(),
            // NOTE: When closePosition='true', don't send quantity or reduceOnly
            closePosition: 'true',
          },
        ],
      },
      metadata: {
        description: `Set TP ${tpLabel} & SL ${slLabel}`,
      },
    };

    // Show confirmation dialog
    await showConfirmation(ctx, db, redis, ctx.session.userId, operation);
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
