/**
 * Trading Service
 * Handles preparation and execution of trading operations via Universal API.
 * Replaces the legacy Aster-specific write engine.
 */
// @ts-ignore
import { Redis } from 'ioredis';
import type { Pool } from 'pg';
import type { TradingOperation, OperationResult } from '../types/trading';
import { UniversalApiService } from './universal-api.service';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

export class QuantityTooSmallError extends Error {
  constructor(
    public baseAsset: string,
    public minQty: string,
    public minQtyUSD: string,
    public formattedQty: string
  ) {
    super(`Quantity too small: ${formattedQty} ${baseAsset}`);
    this.name = 'QuantityTooSmallError';
  }
}

/**
 * Prepare an operation for confirmation
 * Stores it in Redis and returns an ID
 */
export async function prepareForConfirmation(
  redis: Redis,
  db: Pool,
  telegramId: number,
  userId: number,
  operation: TradingOperation,
  client?: any
) {
  const operationId = uuidv4();
  const key = `pending_op:${telegramId}:${operationId}`;

  const description = operation.metadata?.description || `Execute ${operation.operation}`;
  const riskLevel = operation.metadata?.riskLevel || 'medium';
  
  await redis.setex(key, 3600, JSON.stringify({
    userId,
    operation,
    description,
    riskLevel,
    timestamp: Date.now()
  }));

  try {
    const { createOperationRecord } = await import('../db/orders');
    await createOperationRecord(db, {
      operationId,
      telegramId,
      userId,
      operation
    });
  } catch (err) {
    console.error('[TradingService] Failed to log operation to DB:', err);
  }

  return {
    operationId,
    description,
    riskLevel,
    calculatedPreview: operation.metadata?.calculatedPreview,
    needsRecalc: !!operation.metadata?.originalInput
  };
}

/**
 * Execute a pending operation
 */
export async function executePendingOperation(
  db: Pool,
  redis: Redis,
  telegramId: number,
  operationId: string
): Promise<OperationResult> {
  const key = `pending_op:${telegramId}:${operationId}`;
  const data = await redis.get(key);

  if (!data) {
    return { success: false, error: 'Operation not found or expired' };
  }

  const { userId, operation } = JSON.parse(data);
  const op = operation as TradingOperation;
  const exchange = op.metadata?.exchange || 'aster';

  try {
    let result;
    const uid = userId.toString();

    switch (op.operation) {
      case 'CREATE_ORDER':
        result = await UniversalApiService.placeOrder(uid, op.params);
        break;
      case 'CANCEL_ORDER':
        result = await UniversalApiService.cancelOrder(uid, exchange, op.params.orderId);
        break;
      case 'CANCEL_ALL_ORDERS':
        result = await UniversalApiService.cancelAllOrders(uid, exchange, op.params.symbol);
        break;
      case 'CLOSE_POSITION':
        result = await UniversalApiService.placeOrder(uid, op.params);
        break;
      case 'SET_LEVERAGE':
        result = await UniversalApiService.setLeverage(uid, op.params.symbol, op.params.leverage, exchange);
        break;
      case 'SET_MARGIN_MODE':
        result = await UniversalApiService.setMarginMode(uid, op.params.symbol, op.params.marginMode, exchange);
        break;
      default:
        return { success: false, error: `Unsupported operation: ${op.operation}` };
    }

    await redis.del(key);
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error(`[TradingService] Execution failed for ${op.operation}:`, error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message,
      errorCode: error.response?.data?.code 
    };
  }
}

/**
 * Cancel a pending operation
 */
export async function cancelPendingOperation(
  redis: Redis,
  telegramId: number,
  operationId: string
) {
  const key = `pending_op:${telegramId}:${operationId}`;
  await redis.del(key);
}

/**
 * Get a pending operation
 */
export async function getPendingOperation(
  redis: Redis,
  telegramId: number,
  operationId: string
) {
  const key = `pending_op:${telegramId}:${operationId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
