/**
 * Orders Database Functions
 *
 * Handles persistence of all write operations to database for:
 * - Audit trail of all user actions
 * - Confirmation tracking (what users tried vs what they confirmed)
 * - Execution tracking (what succeeded vs failed)
 * - Order history (local queryable history without API calls)
 */

import type { Pool } from 'pg';
import type { TradingOperation } from '../types/trading';
import type { BotContext } from '../types/context';

// ========== Types ==========

export interface OrderRecord {
  id: number;
  user_id: number;
  telegram_id: number;

  // Operation metadata
  operation_id: string;
  operation_type: string;
  operation_data: any;

  // Basic order info
  symbol: string;
  side: string | null;
  type: string | null;
  quantity: string | null;
  price: string | null;

  // Confirmation tracking
  user_confirm: boolean;
  user_confirm_at: Date | null;

  // Exchange execution result
  exchange_order_id: string | null;
  exchange_status: string | null;
  exchange_response: any | null;
  executed_at: Date | null;

  // Execution result
  success: boolean | null;
  error_message: string | null;
  error_code: string | null;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// ========== Create Operation Record ==========

/**
 * Save operation to database when user initiates action
 * Called from prepareForConfirmation()
 *
 * Status: user_confirm = false (not yet confirmed)
 */
export async function createOperationRecord(
  db: Pool,
  params: {
    operationId: string;
    userId: number;
    telegramId: number;
    operation: TradingOperation;
  }
): Promise<number> {
  const { operationId, userId, telegramId, operation } = params;

  // Extract common fields from operation
  const symbol = (operation.params as any).symbol || '';
  const side = (operation.params as any).side || null;
  const type = (operation.params as any).type || null;
  const quantity = (operation.params as any).quantity || null;
  const price = (operation.params as any).price || null;

  const result = await db.query<{ id: number }>(
    `INSERT INTO orders (
      user_id,
      telegram_id,
      operation_id,
      operation_type,
      operation_data,
      symbol,
      side,
      type,
      quantity,
      price,
      user_confirm
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      userId,
      telegramId,
      operationId,
      operation.operation,
      JSON.stringify(operation),
      symbol,
      side,
      type,
      quantity,
      price,
      false, // user_confirm = false
    ]
  );

  return result.rows[0].id;
}

// ========== Update Confirmation ==========

/**
 * Update operation record when user confirms
 * Called from handleConfirm() BEFORE execution
 *
 * Sets: user_confirm = true, user_confirm_at = NOW()
 */
export async function markOperationConfirmed(
  db: Pool,
  operationId: string,
  telegramId: number
): Promise<void> {
  await db.query(
    `UPDATE orders
     SET user_confirm = TRUE,
         user_confirm_at = NOW(),
         updated_at = NOW()
     WHERE operation_id = $1
       AND telegram_id = $2`,
    [operationId, telegramId]
  );
}

// ========== Update Execution Result ==========

/**
 * Update operation record with execution result
 * Called from handleConfirm() AFTER execution
 *
 * Updates:
 * - success = true/false
 * - exchange_order_id (if available)
 * - exchange_status (if available)
 * - exchange_response (full API response)
 * - error_message (if failed)
 * - error_code (if failed)
 * - executed_at = NOW()
 */
export async function updateOperationResult(
  db: Pool,
  operationId: string,
  telegramId: number,
  result: {
    success: boolean;
    data?: any;
    error?: string;
    errorCode?: string;
  }
): Promise<void> {
  // Extract exchange order info if available
  const exchangeOrderId = result.data?.orderId?.toString() || null;
  const exchangeStatus = result.data?.status || null;
  const exchangeResponse = result.data ? JSON.stringify(result.data) : null;

  await db.query(
    `UPDATE orders
     SET success = $1,
         exchange_order_id = $2,
         exchange_status = $3,
         exchange_response = $4,
         error_message = $5,
         error_code = $6,
         executed_at = NOW(),
         updated_at = NOW()
     WHERE operation_id = $7
       AND telegram_id = $8`,
    [
      result.success,
      exchangeOrderId,
      exchangeStatus,
      exchangeResponse,
      result.error || null,
      result.errorCode || null,
      operationId,
      telegramId,
    ]
  );
}

// ========== Mark Cancelled ==========

/**
 * Mark operation as cancelled (never executed)
 * Called from handleCancel()
 *
 * Sets: success = false, error_message = 'User cancelled'
 */
export async function markOperationCancelled(
  db: Pool,
  operationId: string,
  telegramId: number
): Promise<void> {
  await db.query(
    `UPDATE orders
     SET success = FALSE,
         error_message = 'User cancelled operation',
         error_code = 'USER_CANCELLED',
         updated_at = NOW()
     WHERE operation_id = $1
       AND telegram_id = $2
       AND user_confirm = FALSE`,
    [operationId, telegramId]
  );
}

// ========== Query Functions ==========

/**
 * Get order history for user
 * Only returns CONFIRMED and EXECUTED operations (not cancelled drafts)
 */
export async function getUserOrderHistory(
  db: Pool,
  userId: number,
  limit: number = 50
): Promise<OrderRecord[]> {
  const result = await db.query<OrderRecord>(
    `SELECT *
     FROM orders
     WHERE user_id = $1
       AND user_confirm = TRUE
       AND executed_at IS NOT NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get all operations for user (including cancelled drafts)
 * Useful for analytics/debugging
 */
export async function getUserAllOperations(
  db: Pool,
  userId: number,
  limit: number = 100
): Promise<OrderRecord[]> {
  const result = await db.query<OrderRecord>(
    `SELECT *
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get operation by operation_id
 */
export async function getOperationByOperationId(
  db: Pool,
  operationId: string,
  telegramId: number
): Promise<OrderRecord | null> {
  const result = await db.query<OrderRecord>(
    `SELECT *
     FROM orders
     WHERE operation_id = $1
       AND telegram_id = $2`,
    [operationId, telegramId]
  );

  return result.rows[0] || null;
}

/**
 * Get operation by exchange order ID
 */
export async function getOperationByExchangeOrderId(
  db: Pool,
  exchangeOrderId: string,
  userId: number
): Promise<OrderRecord | null> {
  const result = await db.query<OrderRecord>(
    `SELECT *
     FROM orders
     WHERE exchange_order_id = $1
       AND user_id = $2`,
    [exchangeOrderId, userId]
  );

  return result.rows[0] || null;
}

// ========== Analytics ==========

/**
 * Get confirmation rate (how many operations get confirmed vs cancelled)
 */
export async function getConfirmationRate(
  db: Pool,
  userId: number
): Promise<{ total: number; confirmed: number; rate: number }> {
  const result = await db.query<{ total: string; confirmed: string }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE user_confirm = TRUE) as confirmed
     FROM orders
     WHERE user_id = $1`,
    [userId]
  );

  const total = parseInt(result.rows[0].total);
  const confirmed = parseInt(result.rows[0].confirmed);
  const rate = total > 0 ? (confirmed / total) * 100 : 0;

  return { total, confirmed, rate };
}

/**
 * Get success rate (how many confirmed operations succeed)
 */
export async function getSuccessRate(
  db: Pool,
  userId: number
): Promise<{ total: number; successful: number; rate: number }> {
  const result = await db.query<{ total: string; successful: string }>(
    `SELECT
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE success = TRUE) as successful
     FROM orders
     WHERE user_id = $1
       AND user_confirm = TRUE`,
    [userId]
  );

  const total = parseInt(result.rows[0].total);
  const successful = parseInt(result.rows[0].successful);
  const rate = total > 0 ? (successful / total) * 100 : 0;

  return { total, successful, rate };
}
