/**
 * Confirmation Dialog Utility
 *
 * Shows user-friendly confirmation dialogs for write operations.
 * Handles the flow:
 * 1. Build operation from UI
 * 2. Store in Redis
 * 3. Show confirmation with details
 * 4. User confirms → Execute
 * 5. User cancels → Delete from Redis
 */

import { Markup } from 'telegraf';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import type { BotContext } from '../types/context';
import {
  type AsterWriteOp,
  type CreateOrderOp,
  CreateOrderUIParamsSchema,
  getOperationDescription,
  getOperationRiskLevel,
} from '../aster/writeOps';
import type { z } from 'zod';

type CreateOrderUIParams = z.infer<typeof CreateOrderUIParamsSchema>;
import {
  prepareForConfirmation,
  executePendingOperation,
  cancelPendingOperation,
  getPendingOperation,
  QuantityTooSmallError,
} from '../aster/writeEngine';
import { buildPositionInterface } from '../composers/futures-positions/interface';
import { cleanupButtonMessages, trackButtonMessage } from './buttonCleanup';

// No compile-time check needed - discriminated unions handle this at type level

// ========== Formatting Helpers ==========

/**
 * Format operation details for display
 */
function formatOperationDetails(op: AsterWriteOp): string {
  const lines: string[] = [];

  switch (op.operation) {
    case 'CREATE_ORDER':
      lines.push(`📊 **Order Details**`);
      lines.push(`Symbol: ${op.params.symbol}`);
      lines.push(`Side: ${op.params.side === 'BUY' ? '🟢 Long' : '🔴 Short'}`);
      lines.push(`Type: ${op.params.type.replace(/_/g, ' ')}`);

      // Input section - what user provided
      lines.push(``);
      lines.push(`📝 **Input**`);
      if (op.params.quantity) {
        const baseAsset = op.params.symbol.replace('USDT', '');
        lines.push(`Quantity: ${op.params.quantity} ${baseAsset}`);
      } else if (op.params.quantityInUSD) {
        lines.push(`Amount: $${op.params.quantityInUSD} USDT`);
      } else if (op.params.quantityAsPercent) {
        lines.push(`Amount: ${op.params.quantityAsPercent}% of available margin`);
      }

      // Show prices (type-specific fields)
      if (op.params.type === 'LIMIT' || op.params.type === 'STOP' || op.params.type === 'TAKE_PROFIT') {
        lines.push(`Limit Price: $${op.params.price}`);
      }
      if (op.params.type === 'STOP' || op.params.type === 'TAKE_PROFIT' ||
          op.params.type === 'STOP_MARKET' || op.params.type === 'TAKE_PROFIT_MARKET') {
        lines.push(`Stop Price: $${op.params.stopPrice}`);
      }

      // Trailing stop specific
      if (op.params.type === 'TRAILING_STOP_MARKET') {
        if (op.params.activationPrice) {
          lines.push(`Activation Price: $${op.params.activationPrice}`);
        }
        lines.push(`Callback Rate: ${op.params.callbackRate}%`);
      }

      // Settings section
      const settings: string[] = [];
      if (op.metadata?.leverage) {
        settings.push(`Leverage: ${op.metadata.leverage}x`);
      }
      if (op.params.reduceOnly === 'true') {
        settings.push(`Reduce Only: Yes`);
      }
      if ((op.params.type === 'STOP_MARKET' || op.params.type === 'TAKE_PROFIT_MARKET') && op.params.closePosition === 'true') {
        settings.push(`Close Position: Yes`);
      }
      if (op.params.positionSide && op.params.positionSide !== 'BOTH') {
        settings.push(`Position Side: ${op.params.positionSide}`);
      }
      if ((op.params.type === 'LIMIT' || op.params.type === 'STOP' || op.params.type === 'TAKE_PROFIT') &&
          op.params.timeInForce && op.params.timeInForce !== 'GTC') {
        settings.push(`Time In Force: ${op.params.timeInForce}`);
      }
      if (op.params.workingType) {
        settings.push(`Working Type: ${op.params.workingType}`);
      }
      if (op.params.priceProtect === 'TRUE') {
        settings.push(`Price Protection: Enabled`);
      }

      if (settings.length > 0) {
        lines.push(``);
        lines.push(`⚙️ **Settings**`);
        settings.forEach(s => lines.push(s));
      }
      break;

    case 'CANCEL_ORDER':
      lines.push(`Symbol: ${op.params.symbol}`);
      lines.push(`Order ID: ${op.params.orderId}`);
      if (op.metadata?.orderType) {
        lines.push(`Type: ${op.metadata.orderType}`);
      }
      if (op.metadata?.orderSide) {
        lines.push(`Side: ${op.metadata.orderSide}`);
      }
      break;

    case 'CANCEL_ALL_ORDERS':
      lines.push(`Symbol: ${op.params.symbol}`);
      if (op.metadata?.orderCount) {
        lines.push(`Orders to cancel: ${op.metadata.orderCount}`);
      }
      break;

    case 'CLOSE_POSITION':
      lines.push(`Symbol: ${op.params.symbol}`);
      lines.push(`Close: ${op.params.percentage}%`);
      if (op.metadata?.currentSize) {
        lines.push(`Current Size: ${op.metadata.currentSize}`);
      }
      if (op.metadata?.closeSize) {
        lines.push(`Size to Close: ${op.metadata.closeSize}`);
      }
      if (op.metadata?.estimatedPnL) {
        lines.push(`Est. PnL: ${op.metadata.estimatedPnL}`);
      }
      break;

    case 'BATCH_ORDERS':
      lines.push(`Symbol: ${op.params.symbol}`);
      lines.push(`Orders: ${op.params.orders.length}`);
      if (op.metadata?.description) {
        lines.push(`Action: ${op.metadata.description}`);
      }
      break;
  }

  return lines.join('\n');
}

/**
 * Get risk emoji based on risk level
 */
function getRiskEmoji(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'low':
      return '🟢'; // Green - low risk
    case 'medium':
      return '🟡'; // Yellow - medium risk
    case 'high':
      return '🔴'; // Red - high risk
  }
}

/**
 * Get risk warning text
 */
function getRiskWarning(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'low':
      return '';
    case 'medium':
      return '\n⚠️ Please review carefully before confirming.';
    case 'high':
      return '\n🚨 HIGH RISK OPERATION - Double check all details!';
  }
}

// ========== Main Functions ==========

/**
 * Show confirmation dialog for a write operation
 *
 * Flow:
 * 1. Store operation in Redis + DB
 * 2. Show confirmation with details
 * 3. Return operation ID (for handling in callback)
 *
 * @returns Operation ID for use in confirm/cancel callbacks
 */
export async function showConfirmation(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  userId: number,
  operation: AsterWriteOp,
  client?: any // Optional AsterClient for position calculations
): Promise<string> {
  const telegramId = ctx.from!.id;

  try {
    // Store operation and get ID
    const { operationId, description, riskLevel, calculatedPreview, needsRecalc } = await prepareForConfirmation(
      redis,
      db,
      telegramId,
      userId,
      operation,
      client
    );

    // Build confirmation message
    const riskEmoji = getRiskEmoji(riskLevel as any);
    const riskWarning = getRiskWarning(riskLevel as any);
    const details = formatOperationDetails(operation);

    // Add calculated section if available
    let calculatedSection = '';
    if (calculatedPreview) {
      calculatedSection = `\n━━━━━━━━━━━━━━━━━━━━━━\n🧮 **Calculated**\n${calculatedPreview}\n`;
    }

    const message = `${riskEmoji} **Confirm Operation**

${description}

━━━━━━━━━━━━━━━━━━━━━━
${details}${calculatedSection}${riskWarning ? `\n${riskWarning}` : ''}`;


    // Build buttons - add re-calc button if calculation was done
    const buttonRows = [];

    if (needsRecalc) {
      buttonRows.push([
        Markup.button.callback('✅ Confirm', `write_confirm:${operationId}`),
        Markup.button.callback('🔄 Re-calc', `write_recalc:${operationId}`),
      ]);
      buttonRows.push([
        Markup.button.callback('❌ Cancel', `write_cancel:${operationId}`),
      ]);
    } else {
      buttonRows.push([
        Markup.button.callback('✅ Confirm', `write_confirm:${operationId}`),
        Markup.button.callback('❌ Cancel', `write_cancel:${operationId}`),
      ]);
    }

    const buttons = Markup.inlineKeyboard(buttonRows);

    // Clean old button messages before sending confirmation
    await cleanupButtonMessages(ctx);

    // Send confirmation message
    const sentMessage = await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...buttons,
    });

    // Track confirmation message for cleanup
    trackButtonMessage(ctx, sentMessage.message_id);

    return operationId;
  } catch (error) {
    // Handle quantity too small error
    if (error instanceof QuantityTooSmallError) {
      const symbol = (operation as any).params?.symbol;

      let errorMessage = `⚠️ **Amount Too Small**\n\n`;
      errorMessage += `Your amount rounded down to **${error.formattedQty} ${error.baseAsset}** `;
      errorMessage += `due to lot size requirements.\n\n`;
      errorMessage += `📊 **Minimum Required:**\n`;
      errorMessage += `• ${error.minQty} ${error.baseAsset}\n`;
      errorMessage += `• ~$${error.minQtyUSD} USDT\n\n`;
      errorMessage += `Please enter a larger amount.`;

      // Build navigation buttons
      const navButtons = [];
      if (symbol) {
        navButtons.push(Markup.button.callback('📊 Back to Position', `return_position:${symbol}`));
      }
      navButtons.push(Markup.button.callback('🏠 Back to Menu', 'menu'));

      // Clean old button messages
      await cleanupButtonMessages(ctx);

      // Send error message with navigation
      const sentMessage = await ctx.reply(errorMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([navButtons]),
      });

      // Track new message
      trackButtonMessage(ctx, sentMessage.message_id);

      // Return empty string to indicate error was handled (no operation created)
      // The wizard will see this and should exit gracefully
      return '';
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Handle confirmation callback
 * Call this when user clicks "✅ Confirm"
 */
export async function handleConfirm(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  operationId: string
): Promise<void> {
  const telegramId = ctx.from!.id;

  try {
    await ctx.answerCbQuery('Executing...');

    // Get the operation details to show info
    const stored = await getPendingOperation(redis, telegramId, operationId);

    if (!stored) {
      await cleanupButtonMessages(ctx);
      await ctx.reply('❌ Operation not found or expired');
      return;
    }

    // Execute actual trades
    const ENABLE_EXECUTION = true;

    if (ENABLE_EXECUTION) {
      // NEW: Mark operation as confirmed in database BEFORE execution
      const { markOperationConfirmed, updateOperationResult } = await import('../db/orders');
      await markOperationConfirmed(db, operationId, telegramId);

      // Execute the operation
      const result = await executePendingOperation(db, redis, telegramId, operationId);

      // NEW: Update database with execution result
      await updateOperationResult(db, operationId, telegramId, result);

      // Extract returnTo from operation metadata (if wizard set it)
      const returnTo = (stored.operation as any).metadata?.returnTo as { messageId: number; chatId: number } | undefined;
      const symbol = (stored.operation as any).params?.symbol as string | undefined;

      if (result.success) {
        // Success message
        let successText = '\n\n━━━━━━━━━━━━━━━━━━━━━━\n✅ **Operation Successful!**\n\n';

        // Add specific success details based on operation type
        if (result.data) {
          if (result.data.orderId) {
            successText += `Order ID: ${result.data.orderId}\n`;
          }
          if (result.data.status) {
            successText += `Status: ${result.data.status}\n`;
          }
        }

        // Build navigation buttons
        const navButtons = [];
        if (symbol) {
          navButtons.push(Markup.button.callback('📊 Back to Position', `return_position:${symbol}`));
        }
        navButtons.push(Markup.button.callback('🏠 Back to Menu', 'menu'));

        // Try to edit the confirmation message
        try {
          // Get the original confirmation message text
          const originalMessage = ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
            ? ctx.callbackQuery.message.text
            : '';

          await ctx.editMessageText(
            originalMessage + successText,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([navButtons]),
            }
          );
        } catch (editError) {
          // If edit fails, send new message
          await cleanupButtonMessages(ctx);
          const sentMessage = await ctx.reply(successText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([navButtons]),
          });
          trackButtonMessage(ctx, sentMessage.message_id);
        }
      } else {
        // Log error details
        console.error('[Confirm] ❌ Operation execution failed:', {
          operationId,
          errorMessage: result.error,
          errorCode: result.errorCode,
          operation: stored.operation.operation,
          symbol: stored.operation.params?.symbol,
          params: stored.operation.params,
          metadata: stored.operation.metadata,
          userId: stored.userId,
          telegramId: ctx.from.id,
          timestamp: new Date().toISOString(),
        });

        // Error message
        let errorText = '\n\n━━━━━━━━━━━━━━━━━━━━━━\n❌ **Operation Failed**\n\n';
        if (result.error) {
          errorText += `${result.error}\n\n`;
        }

        // Add specific error guidance
        if (result.errorCode === 'INSUFFICIENT_BALANCE') {
          errorText += 'ℹ️ Check your available balance and try again.';
        } else if (result.errorCode === 'RATE_LIMITED') {
          errorText += 'ℹ️ Please wait a moment and try again.';
        }

        // Build navigation buttons
        const navButtons = [];
        if (symbol) {
          navButtons.push(Markup.button.callback('📊 Back to Position', `return_position:${symbol}`));
        }
        navButtons.push(Markup.button.callback('🏠 Back to Menu', 'menu'));

        // Try to edit the confirmation message
        try {
          // Get the original confirmation message text
          const originalMessage = ctx.callbackQuery?.message && 'text' in ctx.callbackQuery.message
            ? ctx.callbackQuery.message.text
            : '';

          await ctx.editMessageText(
            originalMessage + errorText,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([navButtons]),
            }
          );
        } catch (editError) {
          // If edit fails, send new message
          await cleanupButtonMessages(ctx);
          const sentMessage = await ctx.reply(errorText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([navButtons]),
          });
          trackButtonMessage(ctx, sentMessage.message_id);
        }
      }
    } else {
      // Placeholder mode - show that confirmation works
      let message = '⏳ **Operation Confirmed**\n\n';
      message += `**Action:** ${stored.description}\n`;
      message += `**Risk Level:** ${stored.riskLevel.toUpperCase()}\n\n`;
      message += `_Placeholder - Actual execution coming soon!_\n\n`;
      message += `✅ The confirmation system is working correctly.`;

      await cleanupButtonMessages(ctx);
      await ctx.reply(message, { parse_mode: 'Markdown' });

      // Clean up the operation from Redis
      await cancelPendingOperation(redis, telegramId, operationId);
    }
  } catch (error: any) {
    console.error('Error executing operation:', error);
    await cleanupButtonMessages(ctx);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
}

/**
 * Handle cancellation callback
 * Call this when user clicks "❌ Cancel"
 */
export async function handleCancel(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  operationId: string
): Promise<void> {
  const telegramId = ctx.from!.id;

  try {
    await ctx.answerCbQuery('Cancelled');

    // Get operation to extract returnTo context
    const stored = await getPendingOperation(redis, telegramId, operationId);
    const returnTo = (stored?.operation as any)?.metadata?.returnTo as { messageId: number; chatId: number } | undefined;
    const symbol = (stored?.operation as any)?.params?.symbol as string | undefined;

    // NEW: Mark operation as cancelled in database
    const { markOperationCancelled } = await import('../db/orders');
    await markOperationCancelled(db, operationId, telegramId);

    // Delete pending operation from Redis
    await cancelPendingOperation(redis, telegramId, operationId);

    // Build navigation buttons
    const navButtons = [];
    if (symbol) {
      navButtons.push(Markup.button.callback('📊 Back to Position', `return_position:${symbol}`));
    }
    navButtons.push(Markup.button.callback('🏠 Back to Menu', 'menu'));

    // Clean old button messages
    await cleanupButtonMessages(ctx);

    // Send NEW cancellation message
    const sentMessage = await ctx.reply('❌ **Operation Cancelled**', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([navButtons]),
    });

    // Track new message
    trackButtonMessage(ctx, sentMessage.message_id);
  } catch (error: any) {
    console.error('Error cancelling operation:', error);
    await ctx.answerCbQuery('Failed to cancel');
  }
}

/**
 * Handle recalculation callback
 * Call this when user clicks "🔄 Re-calc"
 *
 * This recalculates the quantity with fresh price/position data
 * If successful: updates to new values with NEW operationId
 * If error: shows error + keeps old values + keeps re-calc button with OLD operationId
 */
export async function handleRecalc(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  operationId: string,
  client?: any
): Promise<void> {
  const telegramId = ctx.from!.id;

  try {
    // Get the stored operation first
    const stored = await getPendingOperation(redis, telegramId, operationId);

    if (!stored) {
      await ctx.answerCbQuery('Operation not found');
      await cleanupButtonMessages(ctx);
      await ctx.reply('❌ Operation not found or expired');
      return;
    }

    // Only CREATE_ORDER operations can be recalculated
    if (stored.operation.operation !== 'CREATE_ORDER') {
      await ctx.answerCbQuery('Cannot recalculate');
      return;
    }

    const op = stored.operation as CreateOrderOp;

    // Check if this operation has original input stored
    const originalInput = op.metadata?.originalInput;
    if (!originalInput) {
      await ctx.answerCbQuery('Cannot recalculate');
      return;
    }

    // Show recalculating message
    await ctx.answerCbQuery('Recalculating...');

    try {
      // Build recalculated operation (restore original input)
      const recalcOp: CreateOrderOp = JSON.parse(JSON.stringify(op)); // Deep clone

      if (originalInput.type === 'USD') {
        recalcOp.params.quantityInUSD = originalInput.value;
        delete (recalcOp.params as any).quantity;
      } else if (originalInput.type === 'PERCENT') {
        recalcOp.params.quantityAsPercent = originalInput.value;
        delete (recalcOp.params as any).quantity;
      }

      // Delete the stored original input (will be recalculated fresh)
      delete recalcOp.metadata?.originalInput;

      // Try to prepare new operation (DON'T delete old one yet!)
      const { operationId: newOperationId, description, riskLevel, calculatedPreview, needsRecalc } =
        await prepareForConfirmation(redis, db, telegramId, stored.userId, recalcOp, client);

      // Success! Delete old operation now
      await cancelPendingOperation(redis, telegramId, operationId);

      // Build updated confirmation message with NEW calculated values
      const riskEmoji = getRiskEmoji(riskLevel as any);
      const riskWarning = getRiskWarning(riskLevel as any);
      const details = formatOperationDetails(recalcOp);

      let calculatedSection = '';
      if (calculatedPreview) {
        calculatedSection = `\n━━━━━━━━━━━━━━━━━━━━━━\n🧮 **Calculated**\n${calculatedPreview}\n`;
      }

      const message = `${riskEmoji} **Confirm Operation**

${description}

━━━━━━━━━━━━━━━━━━━━━━
${details}${calculatedSection}${riskWarning ? `\n${riskWarning}` : ''}`;

      // Build buttons with NEW operationId
      const buttonRows = [];
      if (needsRecalc) {
        buttonRows.push([
          Markup.button.callback('✅ Confirm', `write_confirm:${newOperationId}`),
          Markup.button.callback('🔄 Re-calc', `write_recalc:${newOperationId}`),
        ]);
        buttonRows.push([
          Markup.button.callback('❌ Cancel', `write_cancel:${newOperationId}`),
        ]);
      } else {
        buttonRows.push([
          Markup.button.callback('✅ Confirm', `write_confirm:${newOperationId}`),
          Markup.button.callback('❌ Cancel', `write_cancel:${newOperationId}`),
        ]);
      }

      // Clean old button messages
      await cleanupButtonMessages(ctx);

      // Send NEW recalculated confirmation
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttonRows),
      });

      // Track new message
      trackButtonMessage(ctx, sentMessage.message_id);

    } catch (recalcError: any) {
      console.error('[Re-calc] Recalculation failed:', recalcError);

      // Recalc failed - show error with OLD values and OLD operationId
      // Extract old calculated info from the locked-in quantity
      const oldQuantity = op.params.quantity;
      const baseAsset = op.params.symbol.replace('USDT', '');

      let oldCalculatedPreview = '';
      if (oldQuantity) {
        oldCalculatedPreview = `Quantity: ≈ ${parseFloat(oldQuantity).toFixed(6)} ${baseAsset}\n(locked in from previous calculation)`;
      }

      const riskEmoji = getRiskEmoji(stored.riskLevel as any);
      const riskWarning = getRiskWarning(stored.riskLevel as any);
      const details = formatOperationDetails(stored.operation);

      const message = `${riskEmoji} **Confirm Operation**

${stored.description}

━━━━━━━━━━━━━━━━━━━━━━
${details}
━━━━━━━━━━━━━━━━━━━━━━
🧮 **Calculated** (old values)
${oldCalculatedPreview}
━━━━━━━━━━━━━━━━━━━━━━
⚠️ **Recalculation failed:** ${recalcError.message}

You can retry or confirm with the old calculated quantity.`;

      // Keep re-calc button to try again (use OLD operationId - still valid!)
      const buttonRows = [
        [
          Markup.button.callback('✅ Confirm', `write_confirm:${operationId}`),
          Markup.button.callback('🔄 Re-calc', `write_recalc:${operationId}`),
        ],
        [
          Markup.button.callback('❌ Cancel', `write_cancel:${operationId}`),
        ],
      ];

      // Clean old button messages
      await cleanupButtonMessages(ctx);

      // Send NEW error message with old values
      const sentMessage = await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttonRows),
      });

      // Track new message
      trackButtonMessage(ctx, sentMessage.message_id);
    }

  } catch (error: any) {
    console.error('[Re-calc] Handler error:', error);
    await ctx.answerCbQuery('Failed to recalculate');
  }
}

// ========== Convenience Functions ==========

/**
 * Build, confirm, and execute in one flow
 * This is the main function UI components should use
 *
 * Usage:
 * ```typescript
 * const operation: AsterWriteOp = {
 *   operation: 'CREATE_ORDER',
 *   params: { ... },
 *   metadata: { ... }
 * };
 *
 * await confirmAndExecute(ctx, redis, userId, operation);
 * ```
 *
 * The function will:
 * 1. Show confirmation dialog
 * 2. Wait for user to confirm (via callback handler)
 * 3. Execute operation
 * 4. Show result
 */
export async function confirmAndExecute(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  userId: number,
  operation: AsterWriteOp
): Promise<void> {
  // Show confirmation - actual execution happens in callback handler
  await showConfirmation(ctx, db, redis, userId, operation);
}

/**
 * Quick confirmation for low-risk operations
 * Shows simplified confirmation with fewer details
 */
export async function quickConfirm(
  ctx: BotContext,
  db: Pool,
  redis: Redis,
  userId: number,
  operation: AsterWriteOp,
  customMessage?: string
): Promise<string> {
  const telegramId = ctx.from!.id;

  // Store operation
  const { operationId, description } = await prepareForConfirmation(
    redis,
    db,
    telegramId,
    userId,
    operation
  );

  // Simple message
  const message = customMessage || `Confirm: ${description}`;

  // Build buttons
  const buttons = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Yes', `write_confirm:${operationId}`),
      Markup.button.callback('❌ No', `write_cancel:${operationId}`),
    ],
  ]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...buttons,
  });

  return operationId;
}
