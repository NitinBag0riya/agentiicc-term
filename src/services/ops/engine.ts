/**
 * Aster Write Engine
 *
 * Centralized execution engine for all AsterDex write operations.
 * All write operations flow through this engine for:
 * - Type safety validation (Zod)
 * - Uniform error handling
 * - Operation logging/audit trail
 * - Session-based operation storage
 *
 * Flow:
 * 1. UI/LLM builds AsterWriteOp
 * 2. Store operation in Redis with unique ID
 * 3. Show confirmation dialog to user
 * 4. User confirms → Execute operation
 * 5. Return result
 */

import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { UniversalApiClient } from '../universalApi';
import {
  type AsterWriteOp,
  type CreateOrderOp,
  type CancelOrderOp,
  type CancelAllOrdersOp,
  type ClosePositionOp,
  type BatchOrdersOp,
  type SetLeverageOp,
  type SetMarginTypeOp,
  type SetMultiAssetsMarginOp,
  type ModifyIsolatedMarginOp,
  type CreateSpotOrderOp,
  type CancelSpotOrderOp,
  validateWriteOp,
  safeValidateWriteOp,
  getOperationDescription,
  getOperationRiskLevel,
  transformUIParamsToAPI,
} from './types';
import { pendingOpKey, setJSON, getJSON, deleteKeys } from '../../utils/redisKeys';
import { getFuturesPrice } from '../priceCache.service';
import { formatQuantityForSymbol, getLotSizeFilter } from '../../utils/quantityFormatter';

// ========== Constants ==========

const PENDING_OP_TTL = 300; // 5 minutes - operations expire if not confirmed

// ========== Custom Errors ==========

export class QuantityTooSmallError extends Error {
  constructor(
    public symbol: string,
    public formattedQty: string,
    public minQty: string,
    public minQtyUSD: string,
    public baseAsset: string
  ) {
    super('Quantity too small after rounding');
    this.name = 'QuantityTooSmallError';
  }
}

// ========== Types ==========

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
}

export interface StoredOperation {
  operation: AsterWriteOp;
  userId: number; // Database user ID
  telegramId: number; // Telegram user ID
  createdAt: number; // Timestamp
  riskLevel: 'low' | 'medium' | 'high';
  description: string; // Human-readable description
}

// ========== Store Pending Operation ==========

/**
 * Store operation in Redis and return operation ID
 * Operation expires after 5 minutes if not confirmed
 */
export async function storePendingOperation(
  redis: Redis,
  telegramId: number,
  userId: number,
  operation: AsterWriteOp
): Promise<string> {
  // Validate operation first
  const validated = validateWriteOp(operation);

  // Generate unique operation ID (8 chars, URL-safe)
  const operationId = nanoid(8);

  // Store operation with metadata
  const stored: StoredOperation = {
    operation: validated,
    userId,
    telegramId,
    createdAt: Date.now(),
    riskLevel: getOperationRiskLevel(validated),
    description: getOperationDescription(validated),
  };

  const key = pendingOpKey(telegramId, operationId);
  await setJSON(redis, key, stored, PENDING_OP_TTL);

  return operationId;
}

/**
 * Retrieve pending operation from Redis
 * Returns null if not found or expired
 */
export async function getPendingOperation(
  redis: Redis,
  telegramId: number,
  operationId: string
): Promise<StoredOperation | null> {
  const key = pendingOpKey(telegramId, operationId);
  return await getJSON<StoredOperation>(redis, key);
}

/**
 * Delete pending operation from Redis
 * Call after execution or cancellation
 */
export async function deletePendingOperation(
  redis: Redis,
  telegramId: number,
  operationId: string
): Promise<void> {
  const key = pendingOpKey(telegramId, operationId);
  await deleteKeys(redis, key);
}

// ========== Execute Operation ==========

/**
 * Execute a write operation
 *
 * This is the core execution function that dispatches to the correct
 * client method based on the operation type.
 */
export async function executeWriteOperation(
  db: Pool,
  redis: Redis,
  userId: number,
  operation: AsterWriteOp
): Promise<ExecutionResult> {
  try {
    // Initialize Universal API client
    const client = new UniversalApiClient();
    const isSessionInit = await client.initSession(userId);
    if (!isSessionInit) {
        throw new Error('Failed to initialize API session. Please check your credentials.');
    }

    // Dispatch to correct handler based on operation type
    switch (operation.operation) {
      case 'CREATE_ORDER':
        return await executeCreateOrder(client, operation as CreateOrderOp);

      case 'CANCEL_ORDER':
        return await executeCancelOrder(client, operation as CancelOrderOp);

      case 'CANCEL_ALL_ORDERS':
        return await executeCancelAllOrders(client, operation as CancelAllOrdersOp);

      case 'CLOSE_POSITION':
        return await executeClosePosition(client, operation as ClosePositionOp);

      case 'BATCH_ORDERS':
        return await executeBatchOrders(client, operation as BatchOrdersOp);

      case 'SET_LEVERAGE':
        return await executeSetLeverage(client, operation as SetLeverageOp);

      case 'SET_MARGIN_TYPE':
        return await executeSetMarginType(client, operation as SetMarginTypeOp);

      case 'SET_MULTI_ASSETS_MARGIN':
        return await executeSetMultiAssetsMargin(client, operation as SetMultiAssetsMarginOp);

      case 'MODIFY_ISOLATED_MARGIN':
        return await executeModifyIsolatedMargin(client, operation as ModifyIsolatedMarginOp);

      case 'CREATE_SPOT_ORDER':
        return await executeCreateSpotOrder(client, redis, operation as CreateSpotOrderOp);

      case 'CANCEL_SPOT_ORDER':
        return await executeCancelSpotOrder(client, operation as CancelSpotOrderOp);

      default:
        return {
          success: false,
          error: `Unknown operation type: ${(operation as any).operation}`,
          errorCode: 'UNKNOWN_OPERATION',
        };
    }
  } catch (error: any) {
    // Log comprehensive error details
    console.error('[WriteEngine] ❌ Operation failed:', {
      operation: operation.operation,
      symbol: (operation as any).params?.symbol || 'N/A',
      errorMessage: error.message,
      errorCode: error.code,
      errorName: error.name,
      apiResponse: error.response?.data,
      sentParams: (operation as any).params,
      metadata: operation.metadata,
      timestamp: new Date().toISOString(),
      stack: error.stack,
    });

    // Handle Generic errors or Universal API errors (which don't have specific class)
    // removed legacy AsterDexError handling

    // Handle generic errors
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      errorCode: 'EXECUTION_ERROR',
    };
  }
}

// ========== Operation Handlers ==========

/**
 * Execute CREATE_ORDER operation
 *
 * IMPORTANT: Quantity is already calculated and locked in at confirmation time.
 * We do NOT recalculate here - we use exactly what the user confirmed.
 */
async function executeCreateOrder(
  client: UniversalApiClient,
  op: CreateOrderOp
): Promise<ExecutionResult> {
  try {
    // Quantity is already calculated at confirmation time
    // Transform UI params to API params (should be mostly pass-through now)
    const apiParams = transformUIParamsToAPI(op.params, {});

    // Execute order with API params - use exchange from metadata
    const result = await client.placeOrder({
      ...apiParams,
      exchange: op.metadata?.exchange || 'aster' 
    });

    if (!result.success) {
        throw new Error(result.error || 'Failed to create order');
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error; // Re-throw to be caught by main handler
  }
}

/**
 * Execute CANCEL_ORDER operation
 */
async function executeCancelOrder(
  client: UniversalApiClient,
  op: CancelOrderOp
): Promise<ExecutionResult> {
  try {
    const result = await client.cancelOrder(String(op.params.orderId), op.params.symbol);

    if (!result.success) {
        throw new Error(result.error);
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute CANCEL_ALL_ORDERS operation
 */
async function executeCancelAllOrders(
  client: UniversalApiClient,
  op: CancelAllOrdersOp
): Promise<ExecutionResult> {
  try {
    const result = await client.cancelAllOrders(op.params.symbol);

    if (!result.success) {
        throw new Error(result.error);
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute CLOSE_POSITION operation
 */
async function executeClosePosition(
  client: UniversalApiClient,
  op: ClosePositionOp
): Promise<ExecutionResult> {
  try {
    const result = await client.closePosition(op.params.symbol);

    if (!result.success) {
        throw new Error(result.error);
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute BATCH_ORDERS operation
 * Creates multiple orders in sequence
 */
async function executeBatchOrders(
  client: UniversalApiClient,
  op: BatchOrdersOp
): Promise<ExecutionResult> {
  try {
    const results = [];
    const errors = [];

    // Execute orders sequentially
    for (const orderParams of op.params.orders) {
      try {
        const result = await client.placeOrder({ ...orderParams, exchange: op.metadata?.exchange || 'aster' });
        if (!result.success) throw new Error(result.error);
        results.push(result.data);
      } catch (error: any) {
        errors.push({
          params: orderParams,
          error: error.message,
        });
      }
    }

    // If any failed, return partial success
    if (errors.length > 0) {
      return {
        success: false,
        error: `${errors.length} of ${op.params.orders.length} orders failed`,
        errorCode: 'PARTIAL_BATCH_FAILURE',
        data: {
          successful: results,
          failed: errors,
        },
      };
    }

    return {
      success: true,
      data: results,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute SET_LEVERAGE operation
 * Changes leverage for a specific symbol
 */
async function executeSetLeverage(
  client: UniversalApiClient,
  op: SetLeverageOp
): Promise<ExecutionResult> {
  try {
    const result = await client.setLeverage(op.params.symbol, op.params.leverage);
    if (!result.success) throw new Error(result.error);

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute SET_MARGIN_TYPE operation
 * Changes margin type (ISOLATED/CROSSED) for a symbol
 */
async function executeSetMarginType(
  client: UniversalApiClient,
  op: SetMarginTypeOp
): Promise<ExecutionResult> {
  try {
    const result = await client.setMarginMode(op.params.symbol, op.params.marginType);
    if (!result.success) throw new Error(result.error);

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute SET_MULTI_ASSETS_MARGIN operation
 * Toggles Multi-Asset/Single-Asset mode (account-wide)
 */
async function executeSetMultiAssetsMargin(
  client: UniversalApiClient,
  op: SetMultiAssetsMarginOp
): Promise<ExecutionResult> {
  try {
    const result = await client.setMultiAssetsMargin(op.params.multiAssetsMargin === 'true');
    if (!result.success) throw new Error(result.error);

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute MODIFY_ISOLATED_MARGIN operation
 * Adds or reduces margin for isolated positions
 */
async function executeModifyIsolatedMargin(
  client: UniversalApiClient,
  op: ModifyIsolatedMarginOp
): Promise<ExecutionResult> {
  try {
    const result = await client.modifyPositionMargin(
      op.params.symbol,
      op.params.amount,
      op.params.type
    );
     if (!result.success) throw new Error(result.error);

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    throw error;
  }
}

// ========== Convenience Functions ==========

/**
 * Store, execute, and cleanup operation in one call
 * Use when operation is already confirmed (no dialog needed)
 */
export async function executeImmediately(
  db: Pool,
  redis: Redis,
  telegramId: number,
  userId: number,
  operation: AsterWriteOp
): Promise<ExecutionResult> {
  // Validate first
  const validation = safeValidateWriteOp(operation);
  if (!validation.success) {
    return {
      success: false,
      error: 'Invalid operation: ' + validation.error?.errors[0]?.message,
      errorCode: 'VALIDATION_ERROR',
    };
  }

  // Execute
  return await executeWriteOperation(db, redis, userId, validation.data!);
}

/**
 * Store operation and prepare for confirmation flow
 * Returns operation ID for confirmation callback
 *
 * IMPORTANT: Now saves operation to database with user_confirm=false
 */
export async function prepareForConfirmation(
  redis: Redis,
  db: Pool,
  telegramId: number,
  userId: number,
  operation: AsterWriteOp,
  client?: any // Deprecated optional client
): Promise<{ operationId: string; description: string; riskLevel: string; calculatedPreview?: string; needsRecalc?: boolean }> {
  let calculatedPreview: string | undefined;
  let needsRecalc = false;

  // Initialize client if we need it for calculations
  let univClient: UniversalApiClient | null = null;

  // For CREATE_ORDER, calculate and LOCK IN the quantity at confirmation time
  if (operation.operation === 'CREATE_ORDER') {
    const op = operation as CreateOrderOp;

    if (op.params.quantityInUSD) {
      // For LIMIT orders, use the limit price. For MARKET orders, use cached market price
      let price: number | null = null;
      let priceSource = '';

      if (op.params.type === 'LIMIT' && op.params.price) {
        price = parseFloat(op.params.price);
        priceSource = `$${price} (limit price)`;
      } else {
        const cachedPrice = getFuturesPrice(op.params.symbol);
        if (cachedPrice) {
          price = parseFloat(cachedPrice);
          priceSource = `$${price} (current market)`;
        }
      }

      if (price) {
        // Apply leverage: $10 margin with 5x leverage = $50 position value
        const leverage = op.metadata?.leverage || 1;
        const positionValue = parseFloat(op.params.quantityInUSD) * leverage;
        const rawQuantity = positionValue / price;
        
        console.log('[PrepareForConfirmation] Quantity calc:', {
          quantityInUSD: op.params.quantityInUSD,
          leverage,
          positionValue,
          price,
          rawQuantity,
          metadataLeverage: op.metadata?.leverage,
        });
        
        const baseAsset = op.params.symbol.replace('USDT', '');

        // Format quantity to match exchange stepSize requirements
        const formattedQuantity = formatQuantityForSymbol(op.params.symbol, rawQuantity);
        if (!formattedQuantity) {
          throw new Error(`Unable to format quantity for ${op.params.symbol}. Check exchange info is loaded.`);
        }

        // Check if formatted quantity is zero or too small
        const formattedQtyNum = parseFloat(formattedQuantity);
        const lotSizeFilter = getLotSizeFilter(op.params.symbol);

        if (formattedQtyNum <= 0 || (lotSizeFilter && formattedQtyNum < parseFloat(lotSizeFilter.minQty))) {
          // Calculate minimum USD value
          const minQty = lotSizeFilter?.minQty || '0';
          const minQtyUSD = (parseFloat(minQty) * price).toFixed(2);

          throw new QuantityTooSmallError(
            op.params.symbol,
            formattedQuantity,
            minQty,
            minQtyUSD,
            baseAsset
          );
        }

        // Store original input in metadata for re-calc
        if (!op.metadata) op.metadata = {};
        op.metadata.originalInput = { type: 'USD', value: op.params.quantityInUSD };

        // IMPORTANT: Replace quantityInUSD with calculated & FORMATTED quantity
        // This locks in the quantity the user confirmed
        delete (op.params as any).quantityInUSD;
        op.params.quantity = formattedQuantity;

        calculatedPreview = `Quantity: ≈ ${formattedQuantity} ${baseAsset}\nPrice: ${priceSource}`;
        needsRecalc = true; // Show re-calc button
      } else {
        // Price unavailable - cannot calculate quantity
        throw new Error(`Price unavailable for ${op.params.symbol}. Cannot calculate quantity from USD amount.`);
      }
    } else if (op.params.quantityAsPercent) {
      univClient = new UniversalApiClient();
      await univClient.initSession(userId);

      // Handle REDUCE_ONLY (Closing/Reducing Position)
      if (op.params.reduceOnly === true || op.params.reduceOnly === 'true') {
        // Fetch current position size
        const positionsRes = await univClient.getPositions(op.params.symbol);
        if (!positionsRes.success) throw new Error(positionsRes.error || 'Failed to fetch positions');
        
        const position = positionsRes.data.find(p => p.symbol === op.params.symbol);
        const positionAmt = position ? parseFloat(position.size || position.positionAmt || '0') : 0;
        const positionSize = Math.abs(positionAmt);

        if (positionSize === 0) {
          throw new Error(`No open position found for ${op.params.symbol} to close.`);
        }

        const percent = parseFloat(op.params.quantityAsPercent);
        const rawQuantity = (positionSize * percent) / 100;
        const baseAsset = op.params.symbol.replace('USDT', '');

        // Format quantity
        const formattedQuantity = formatQuantityForSymbol(op.params.symbol, rawQuantity);
        if (!formattedQuantity) {
          throw new Error(`Unable to format quantity for ${op.params.symbol}. Check exchange info is loaded.`);
        }

        const formattedQtyNum = parseFloat(formattedQuantity);
         if (formattedQtyNum <= 0) {
             throw new Error(`Calculated quantity is too small to close.`);
         }

        // Store original input in metadata for re-calc
        if (!op.metadata) op.metadata = {};
        op.metadata.originalInput = { type: 'PERCENT', value: op.params.quantityAsPercent };

        // IMPORTANT: Replace quantityAsPercent with calculated & FORMATTED quantity
        delete (op.params as any).quantityAsPercent;
        op.params.quantity = formattedQuantity;

        calculatedPreview = `Action: Close ${percent}% of Position\nQuantity: ≈ ${formattedQuantity} ${baseAsset}\nCurrent Size: ${positionSize} ${baseAsset}`;
        needsRecalc = true;

      } else {
        // Open New Position (Calculate from available margin)
        const accountRes = await univClient.getAccount();
        if (!accountRes.success || !accountRes.data) throw new Error('Failed to fetch account info');
        
        const accountInfo = accountRes.data;
        const availableBalance = parseFloat(accountInfo.availableBalance || '0');
        const percent = parseFloat(op.params.quantityAsPercent);

        // Get price (limit price if LIMIT order, otherwise market price)
        let price: number | null = null;
        let priceSource = '';

        if (op.params.type === 'LIMIT' && op.params.price) {
          price = parseFloat(op.params.price);
          priceSource = `$${price} (limit price)`;
        } else {
          const cachedPrice = getFuturesPrice(op.params.symbol);
          if (cachedPrice) {
            price = parseFloat(cachedPrice);
            priceSource = `$${price} (current market)`;
          }
        }

        if (!price) {
          throw new Error(`Price unavailable for ${op.params.symbol}. Cannot calculate quantity from percentage.`);
        }

        // Calculate margin to use
        const marginToUse = (availableBalance * percent) / 100;

        // Apply leverage to get position value
        const leverage = op.metadata?.leverage || 1;
        const positionValue = marginToUse * leverage;

        // Convert to quantity
        const rawQuantity = positionValue / price;
        const baseAsset = op.params.symbol.replace('USDT', '');

        // Format quantity to match exchange stepSize requirements
        const formattedQuantity = formatQuantityForSymbol(op.params.symbol, rawQuantity);
        if (!formattedQuantity) {
          throw new Error(`Unable to format quantity for ${op.params.symbol}. Check exchange info is loaded.`);
        }

        // Check if formatted quantity is zero or too small
        const formattedQtyNum = parseFloat(formattedQuantity);
        const lotSizeFilter = getLotSizeFilter(op.params.symbol);

        if (formattedQtyNum <= 0 || (lotSizeFilter && formattedQtyNum < parseFloat(lotSizeFilter.minQty))) {
          // Calculate minimum USD value
          const minQty = lotSizeFilter?.minQty || '0';
          const minQtyUSD = (parseFloat(minQty) * price).toFixed(2);

          throw new QuantityTooSmallError(
            op.params.symbol,
            formattedQuantity,
            minQty,
            minQtyUSD,
            baseAsset
          );
        }

        // Store original input in metadata for re-calc
        if (!op.metadata) op.metadata = {};
        op.metadata.originalInput = { type: 'PERCENT', value: op.params.quantityAsPercent };

        // IMPORTANT: Replace quantityAsPercent with calculated & FORMATTED quantity
        delete (op.params as any).quantityAsPercent;
        op.params.quantity = formattedQuantity;

        calculatedPreview = `Quantity: ≈ ${formattedQuantity} ${baseAsset}\nMargin: $${marginToUse.toFixed(2)} (${percent}% of $${availableBalance.toFixed(2)})\nPosition Value: $${positionValue.toFixed(2)} (${leverage}x leverage)\nPrice: ${priceSource}`;
        needsRecalc = true; // Show re-calc button
      }
    }
  }

  const operationId = await storePendingOperation(redis, telegramId, userId, operation);

  // NEW: Save operation to database with user_confirm=false
  const { createOperationRecord } = await import('../../db/orders');
  await createOperationRecord(db, {
    operationId,
    userId,
    telegramId,
    operation,
  });

  return {
    operationId,
    description: getOperationDescription(operation),
    riskLevel: getOperationRiskLevel(operation),
    calculatedPreview,
    needsRecalc,
  };
}

/**
 * Execute pending operation by ID
 * Used when user confirms operation
 */
export async function executePendingOperation(
  db: Pool,
  redis: Redis,
  telegramId: number,
  operationId: string
): Promise<ExecutionResult> {
  // Retrieve operation
  const stored = await getPendingOperation(redis, telegramId, operationId);

  if (!stored) {
    return {
      success: false,
      error: 'Operation not found or expired',
      errorCode: 'OPERATION_NOT_FOUND',
    };
  }

  // Execute
  const result = await executeWriteOperation(
    db,
    redis,
    stored.userId,
    stored.operation
  );

  // Cleanup regardless of success/failure
  await deletePendingOperation(redis, telegramId, operationId);

  return result;
}

// ========== Spot Trading Handlers ==========

/**
 * Execute CREATE_SPOT_ORDER
 */
async function executeCreateSpotOrder(
  client: UniversalApiClient,
  redis: Redis,
  operation: CreateSpotOrderOp
): Promise<ExecutionResult> {
  try {
    // Hyperliquid spot is now supported via placeSpotOrder in the adapter
    // Routes.ts handles routing to the correct method

    const { params } = operation;
    let finalParams = { ...params };

    if (params.quantityInUSD) {
      const usdAmount = parseFloat(params.quantityInUSD);
      if (params.side === 'BUY') {
        finalParams.quoteOrderQty = usdAmount.toString();
        delete finalParams.quantity;
      } else {
        const assetsRes = await client.getAssets();
        if (!assetsRes.success) throw new Error('Failed to fetch assets');
        
        const baseAsset = params.symbol.replace('USDT', '');
        const assetBalance = assetsRes.data.find((b: any) => b.asset === baseAsset);
        if (!assetBalance || parseFloat(assetBalance.free || '0') === 0) {
          return { success: false, error: `No ${baseAsset} balance`, errorCode: 'INSUFFICIENT_BALANCE' };
        }

        const tickerRes = await client.getTicker(params.symbol);
        if (!tickerRes.success) throw new Error('Failed to fetch ticker');
        const currentPrice = parseFloat(tickerRes.data.lastPrice);
        
        const sellQuantity = usdAmount / currentPrice;
        const formatted = formatQuantityForSymbol(params.symbol, sellQuantity);
        if (!formatted) throw new Error(`Invalid quantity formatting for ${params.symbol}`);
        finalParams.quantity = formatted;
      }
    } else if (params.quantityAsPercent) {
       // Similar refactor for percent
       const percent = parseFloat(params.quantityAsPercent);
       const assetsRes = await client.getAssets();
       if (!assetsRes.success) throw new Error('Failed to fetch assets');
       
       if (params.side === 'BUY') {
        // BUY: percentage of USDT balance
        const usdtBalance = assetsRes.data.find((b: any) => b.asset === 'USDT');
        if (!usdtBalance || parseFloat(usdtBalance.free || '0') === 0) {
          return {
            success: false,
            error: 'No USDT balance available',
            errorCode: 'INSUFFICIENT_BALANCE',
          };
        }

        const usdtAmount = parseFloat(usdtBalance.free || '0') * (percent / 100);
        finalParams.quoteOrderQty = usdtAmount.toString();
        delete finalParams.quantity;
      } else {
        // SELL: percentage of asset balance
        const baseAsset = params.symbol.replace('USDT', '');
        const assetBalance = assetsRes.data.find((b: any) => b.asset === baseAsset);

        if (!assetBalance || parseFloat(assetBalance.free || '0') === 0) {
          return {
            success: false,
            error: `No ${baseAsset} balance available to sell`,
            errorCode: 'INSUFFICIENT_BALANCE',
          };
        }

        const sellQty = parseFloat(assetBalance.free || '0') * (percent / 100);
        const formatted = formatQuantityForSymbol(params.symbol, sellQty);
        if (!formatted) throw new Error(`Invalid quantity formatting for ${params.symbol}`);
        finalParams.quantity = formatted;
      }
    }

    // Clean up UI helpers
    delete finalParams.quantityInUSD;
    delete finalParams.quantityAsPercent;

    // Execute spot order
    const result = await client.placeOrder({ ...finalParams, exchange: operation.metadata?.exchange || 'aster' });
    if (!result.success) throw new Error(result.error);

    return { success: true, data: result.data };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Execute CANCEL_SPOT_ORDER
 */
async function executeCancelSpotOrder(
  client: UniversalApiClient,
  op: CancelSpotOrderOp
): Promise<ExecutionResult> {
  try {
    const result = await client.cancelOrder(String(op.params.orderId), op.params.symbol);
    if (!result.success) throw new Error(result.error);
    return { success: true, data: result.data };
  } catch (error: any) {
    throw error;
  }
}

/**
 * Cancel pending operation
 * Used when user cancels confirmation
 */
export async function cancelPendingOperation(
  redis: Redis,
  telegramId: number,
  operationId: string
): Promise<void> {
  await deletePendingOperation(redis, telegramId, operationId);
}
