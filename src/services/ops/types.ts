/**
 * Zod schemas for all AsterDex write operations
 *
 * Purpose: Type-safe operation definitions that can be:
 * - Built from UI interactions (buttons/forms)
 * - Generated from LLM natural language processing
 * - Validated before execution
 * - Stored in session for confirmation flow
 * - Audited and logged
 */

import { z } from 'zod';
import { formatQuantityForSymbol, formatPriceForSymbol } from '../../utils/quantityFormatter';

// ========== Base Schemas ==========

const SymbolSchema = z.string().min(1, 'Symbol is required');

const SideSchema = z.enum(['BUY', 'SELL'], {
  errorMap: () => ({ message: 'Side must be BUY or SELL' })
});

const OrderTypeSchema = z.enum([
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_MARKET',
  'TAKE_PROFIT',
  'TAKE_PROFIT_MARKET'
], {
  errorMap: () => ({ message: 'Invalid order type' })
});

const TimeInForceSchema = z.enum(['GTC', 'IOC', 'FOK', 'GTX']).optional();

const WorkingTypeSchema = z.enum(['MARK_PRICE', 'CONTRACT_PRICE']).optional();

// ========== API Params Schemas (what the exchange API expects) ==========

/**
 * Common fields shared by all order types
 */
const BaseOrderFields = {
  symbol: SymbolSchema,
  side: SideSchema,
  reduceOnly: z.enum(['true', 'false']).optional(),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional(),
  workingType: WorkingTypeSchema,
  priceProtect: z.enum(['TRUE', 'FALSE']).optional(),
  newClientOrderId: z.string().max(36).optional(),
  newOrderRespType: z.enum(['ACK', 'RESULT']).optional(),
};

/**
 * MARKET order: quantity required, price NOT ALLOWED
 */
const MarketOrderSchema = z.object({
  ...BaseOrderFields,
  type: z.literal('MARKET'),
  quantity: z.string(),
});

/**
 * LIMIT order: quantity, price, timeInForce all REQUIRED
 */
const LimitOrderSchema = z.object({
  ...BaseOrderFields,
  type: z.literal('LIMIT'),
  quantity: z.string(),
  price: z.string(), // REQUIRED
  timeInForce: z.enum(['GTC', 'IOC', 'FOK', 'GTX']), // REQUIRED
});

/**
 * STOP/TAKE_PROFIT: quantity, price, stopPrice REQUIRED
 */
const StopOrderSchema = z.object({
  ...BaseOrderFields,
  type: z.enum(['STOP', 'TAKE_PROFIT']),
  quantity: z.string(),
  price: z.string(), // REQUIRED
  stopPrice: z.string(), // REQUIRED
  timeInForce: TimeInForceSchema, // Optional (default GTC)
});

/**
 * STOP_MARKET/TAKE_PROFIT_MARKET: stopPrice REQUIRED, quantity optional if closePosition=true
 */
const StopMarketOrderSchema = z.object({
  ...BaseOrderFields,
  type: z.enum(['STOP_MARKET', 'TAKE_PROFIT_MARKET']),
  quantity: z.string().optional(), // Optional if closePosition=true
  stopPrice: z.string(), // REQUIRED
  closePosition: z.enum(['true', 'false']).optional(),
});
// Note: quantity OR closePosition validation happens in transformer

/**
 * TRAILING_STOP_MARKET: callbackRate REQUIRED
 */
const TrailingStopMarketOrderSchema = z.object({
  ...BaseOrderFields,
  type: z.literal('TRAILING_STOP_MARKET'),
  quantity: z.string().optional(),
  callbackRate: z.string(), // REQUIRED
  activationPrice: z.string().optional(),
});

/**
 * Discriminated union of all order types
 * TypeScript will enforce correct fields per type!
 */
export const CreateOrderAPIParamsSchema = z.discriminatedUnion('type', [
  MarketOrderSchema,
  LimitOrderSchema,
  StopOrderSchema,
  StopMarketOrderSchema,
  TrailingStopMarketOrderSchema,
]);

// ========== UI Schemas (what the UI provides) ==========

/**
 * Common UI fields - all order types support flexible quantity input
 */
const BaseUIFields = {
  symbol: SymbolSchema,
  side: SideSchema,
  // Flexible quantity input (UI provides ONE of these):
  quantity: z.string().optional(),
  quantityInUSD: z.string().optional(),
  quantityAsPercent: z.string().optional(),
  // Common optional fields:
  reduceOnly: z.enum(['true', 'false']).optional(),
  positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional(),
  workingType: WorkingTypeSchema,
  priceProtect: z.enum(['TRUE', 'FALSE']).optional(),
  newClientOrderId: z.string().max(36).optional(),
  newOrderRespType: z.enum(['ACK', 'RESULT']).optional(),
};

/**
 * MARKET order UI: price NOT ALLOWED
 */
const MarketOrderUISchema = z.object({
  ...BaseUIFields,
  type: z.literal('MARKET'),
});

/**
 * LIMIT order UI: price REQUIRED
 */
const LimitOrderUISchema = z.object({
  ...BaseUIFields,
  type: z.literal('LIMIT'),
  price: z.string(), // REQUIRED
  timeInForce: TimeInForceSchema, // Optional (defaults to GTC)
});

/**
 * STOP/TAKE_PROFIT UI: price and stopPrice REQUIRED
 */
const StopOrderUISchema = z.object({
  ...BaseUIFields,
  type: z.enum(['STOP', 'TAKE_PROFIT']),
  price: z.string(), // REQUIRED
  stopPrice: z.string(), // REQUIRED
  timeInForce: TimeInForceSchema,
});

/**
 * STOP_MARKET/TAKE_PROFIT_MARKET UI: stopPrice REQUIRED
 */
const StopMarketOrderUISchema = z.object({
  ...BaseUIFields,
  type: z.enum(['STOP_MARKET', 'TAKE_PROFIT_MARKET']),
  stopPrice: z.string(), // REQUIRED
  closePosition: z.enum(['true', 'false']).optional(),
});

/**
 * TRAILING_STOP_MARKET UI: callbackRate REQUIRED
 */
const TrailingStopMarketOrderUISchema = z.object({
  ...BaseUIFields,
  type: z.literal('TRAILING_STOP_MARKET'),
  callbackRate: z.string(), // REQUIRED
  activationPrice: z.string().optional(),
});

/**
 * Discriminated union - TypeScript enforces correct fields per order type!
 * Note: Quantity variant validation happens in transformer
 */
export const CreateOrderUIParamsSchema = z.discriminatedUnion('type', [
  MarketOrderUISchema,
  LimitOrderUISchema,
  StopOrderUISchema,
  StopMarketOrderUISchema,
  TrailingStopMarketOrderUISchema,
]);

// ========== Write Operation Schemas ==========

/**
 * CREATE_ORDER - Create a new order (market, limit, stop, etc.)
 *
 * Use cases:
 * - Open new position (Long/Short)
 * - Add to existing position (Ape)
 * - Set TP/SL orders
 * - Place limit orders
 */
export const CreateOrderOpSchema = z.object({
  operation: z.literal('CREATE_ORDER'),
  params: CreateOrderUIParamsSchema,

  // UI metadata (not sent to API, used for display)
  metadata: z.object({
    action: z.string().optional(), // Human-readable action (e.g., "Long $50", "Set TP")
    leverage: z.number().optional(), // Current leverage for display
    originalInput: z.object({
      type: z.enum(['USD', 'PERCENT']),
      value: z.string(),
    }).optional(), // For re-calc: stores original USD/percent input before conversion
    returnTo: z.object({
      messageId: z.number(),
      chatId: z.number(),
    }).optional(), // Where to return after operation completes
  }).optional(),
});

/**
 * CANCEL_ORDER - Cancel a specific order by ID
 */
export const CancelOrderOpSchema = z.object({
  operation: z.literal('CANCEL_ORDER'),
  params: z.object({
    symbol: SymbolSchema,
    orderId: z.number().int().positive('Order ID must be positive'),
  }),

  metadata: z.object({
    orderType: z.string().optional(), // e.g., "STOP_MARKET"
    orderSide: z.string().optional(), // e.g., "SELL"
  }).optional(),
});

/**
 * CANCEL_ALL_ORDERS - Cancel all open orders for a symbol
 */
export const CancelAllOrdersOpSchema = z.object({
  operation: z.literal('CANCEL_ALL_ORDERS'),
  params: z.object({
    symbol: SymbolSchema,
  }),

  metadata: z.object({
    orderCount: z.number().optional(), // Number of orders being cancelled
  }).optional(),
});

/**
 * CLOSE_POSITION - Close a position (market order to close)
 *
 * This is a convenience wrapper around CREATE_ORDER with closePosition=true
 */
export const ClosePositionOpSchema = z.object({
  operation: z.literal('CLOSE_POSITION'),
  params: z.object({
    symbol: SymbolSchema,
    percentage: z.number()
      .min(1, 'Percentage must be at least 1%')
      .max(100, 'Percentage cannot exceed 100%')
      .default(100),
  }),

  metadata: z.object({
    currentSize: z.string().optional(), // Current position size
    closeSize: z.string().optional(), // Size to close
    estimatedPnL: z.string().optional(), // Estimated PnL
  }).optional(),
});

/**
 * BATCH_ORDERS - Create multiple orders atomically (future use)
 *
 * Use case: Set TP and SL simultaneously
 */
export const BatchOrdersOpSchema = z.object({
  operation: z.literal('BATCH_ORDERS'),
  params: z.object({
    symbol: SymbolSchema,
    orders: z.array(CreateOrderOpSchema.shape.params).min(1).max(5),
  }),

  metadata: z.object({
    description: z.string().optional(), // e.g., "Set TP & SL"
  }).optional(),
});

/**
 * SET_LEVERAGE - Change leverage for a specific symbol
 *
 * API: POST /fapi/v1/leverage
 * Must be called before placing orders
 * Affects existing positions for that symbol
 */
export const SetLeverageOpSchema = z.object({
  operation: z.literal('SET_LEVERAGE'),
  params: z.object({
    symbol: SymbolSchema,
    leverage: z.number().int().min(1).max(125),
  }),

  metadata: z.object({
    previousLeverage: z.number().optional(), // Previous leverage (for display)
    hasOpenPosition: z.boolean().optional(), // If there's an open position
  }).optional(),
});

/**
 * SET_MARGIN_TYPE - Change margin type (CROSSED/ISOLATED) for a symbol
 *
 * API: POST /fapi/v1/marginType
 * Can only be changed when there are NO open positions/orders
 * Requires Single-Asset Mode for isolated margin
 */
export const SetMarginTypeOpSchema = z.object({
  operation: z.literal('SET_MARGIN_TYPE'),
  params: z.object({
    symbol: SymbolSchema,
    marginType: z.enum(['ISOLATED', 'CROSSED']),
  }),

  metadata: z.object({
    previousMarginType: z.string().optional(), // Just for display - don't validate (API returns lowercase)
    multiAssetsMargin: z.boolean().optional(), // Current asset mode
  }).optional(),
});

/**
 * SET_MULTI_ASSETS_MARGIN - Toggle Multi-Asset/Single-Asset mode
 *
 * API: POST /fapi/v1/multiAssetsMargin
 * Affects entire account (all symbols)
 * Required to use ISOLATED margin type
 */
export const SetMultiAssetsMarginOpSchema = z.object({
  operation: z.literal('SET_MULTI_ASSETS_MARGIN'),
  params: z.object({
    multiAssetsMargin: z.enum(['true', 'false']), // "true" = Multi-Asset, "false" = Single-Asset
  }),

  metadata: z.object({
    previousMode: z.enum(['true', 'false']).optional(),
    modeLabel: z.string().optional(), // "Multi-Asset Mode" or "Single-Asset Mode"
  }).optional(),
});

/**
 * MODIFY_ISOLATED_MARGIN - Add or reduce margin for isolated position
 *
 * API: POST /fapi/v1/positionMargin
 * Only works for isolated margin positions
 * Type: 1 = Add margin, 2 = Reduce margin
 */
export const ModifyIsolatedMarginOpSchema = z.object({
  operation: z.literal('MODIFY_ISOLATED_MARGIN'),
  params: z.object({
    symbol: SymbolSchema,
    amount: z.string(), // DECIMAL as string
    type: z.enum(['1', '2']), // 1 = Add, 2 = Reduce
    positionSide: z.enum(['BOTH', 'LONG', 'SHORT']).optional(), // Required for hedge mode
  }),

  metadata: z.object({
    actionLabel: z.string().optional(), // "Add $50 margin" or "Reduce $20 margin"
    currentIsolatedMargin: z.string().optional(), // Current isolated margin amount
    newIsolatedMargin: z.string().optional(), // Estimated new margin
  }).optional(),
});

// ========== Spot Trading Operations ==========

/**
 * CREATE_SPOT_ORDER - Create a spot market order
 *
 * API: POST /api/v1/order
 * Spot trading (no leverage, 1:1 trading)
 *
 * Use cases:
 * - Buy crypto with USDT
 * - Sell crypto for USDT
 */
export const CreateSpotOrderOpSchema = z.object({
  operation: z.literal('CREATE_SPOT_ORDER'),
  params: z.object({
    symbol: SymbolSchema, // e.g., "ASTERUSDT"
    side: SideSchema, // BUY or SELL
    type: z.enum(['MARKET', 'LIMIT']), // Start with MARKET only
    quantity: z.string().optional(), // For MARKET/LIMIT: exact quantity
    quoteOrderQty: z.string().optional(), // For MARKET BUY: buy with USDT amount
    price: z.string().optional(), // Required for LIMIT
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(), // Required for LIMIT
    newClientOrderId: z.string().max(36).optional(),

    // UI helpers (like futures)
    quantityInUSD: z.string().optional(), // "$50" → converts to quoteOrderQty
    quantityAsPercent: z.string().optional(), // "50%" → converts to quantity or quoteOrderQty
  }),

  metadata: z.object({
    action: z.string().optional(), // "Buy $50 ASTER" or "Sell 100% ASTER"
    baseAsset: z.string().optional(), // "ASTER" (for display)
    quoteAsset: z.string().optional(), // "USDT" (for display)
    originalInput: z.object({
      type: z.enum(['USD', 'PERCENT', 'ASSET']),
      value: z.string(),
    }).optional(),
  }).optional(),
});

/**
 * CANCEL_SPOT_ORDER - Cancel a spot order
 *
 * API: DELETE /api/v1/order
 */
export const CancelSpotOrderOpSchema = z.object({
  operation: z.literal('CANCEL_SPOT_ORDER'),
  params: z.object({
    symbol: SymbolSchema,
    orderId: z.number().int().positive(),
  }),

  metadata: z.object({
    orderType: z.string().optional(), // "LIMIT" or "MARKET"
  }).optional(),
});

// ========== Union of All Operations ==========

/**
 * AsterWriteOp - Discriminated union of all possible write operations
 *
 * This is the core type that flows through the system:
 * UI → Build Op → Store in Session → Show Confirmation → Execute → Log
 */
export const AsterWriteOpSchema = z.discriminatedUnion('operation', [
  CreateOrderOpSchema,
  CancelOrderOpSchema,
  CancelAllOrdersOpSchema,
  ClosePositionOpSchema,
  BatchOrdersOpSchema,
  SetLeverageOpSchema,
  SetMarginTypeOpSchema,
  SetMultiAssetsMarginOpSchema,
  ModifyIsolatedMarginOpSchema,
  CreateSpotOrderOpSchema,
  CancelSpotOrderOpSchema,
]);

export type AsterWriteOp = z.infer<typeof AsterWriteOpSchema>;

// Export individual operation types for convenience
export type CreateOrderOp = z.infer<typeof CreateOrderOpSchema>;
export type CancelOrderOp = z.infer<typeof CancelOrderOpSchema>;
export type CancelAllOrdersOp = z.infer<typeof CancelAllOrdersOpSchema>;
export type ClosePositionOp = z.infer<typeof ClosePositionOpSchema>;
export type BatchOrdersOp = z.infer<typeof BatchOrdersOpSchema>;
export type SetLeverageOp = z.infer<typeof SetLeverageOpSchema>;
export type SetMarginTypeOp = z.infer<typeof SetMarginTypeOpSchema>;
export type SetMultiAssetsMarginOp = z.infer<typeof SetMultiAssetsMarginOpSchema>;
export type ModifyIsolatedMarginOp = z.infer<typeof ModifyIsolatedMarginOpSchema>;
export type CreateSpotOrderOp = z.infer<typeof CreateSpotOrderOpSchema>;
export type CancelSpotOrderOp = z.infer<typeof CancelSpotOrderOpSchema>;

// ========== Helper Functions ==========

/**
 * Validate an operation against the schema
 * Returns validated operation or throws ZodError
 */
export function validateWriteOp(op: unknown): AsterWriteOp {
  return AsterWriteOpSchema.parse(op);
}

/**
 * Safe validation that returns errors instead of throwing
 */
export function safeValidateWriteOp(op: unknown): {
  success: boolean;
  data?: AsterWriteOp;
  error?: z.ZodError;
} {
  const result = AsterWriteOpSchema.safeParse(op);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Transform UI params to API params
 * Converts quantity variants (USD, percent) to actual base asset quantity
 */
export type TransformContext = {
  currentPrice?: number; // Current market price (for USD conversion)
  positionSize?: number; // Current position size (for percent conversion)
};

export function transformUIParamsToAPI(
  uiParams: z.infer<typeof CreateOrderUIParamsSchema>,
  context: TransformContext = {}
): z.infer<typeof CreateOrderAPIParamsSchema> {
  // Helper: Convert quantity variants to actual quantity
  const resolveQuantity = (): string => {
    // Direct quantity
    if (uiParams.quantity) {
      const formatted = formatQuantityForSymbol(uiParams.symbol, parseFloat(uiParams.quantity));
      if (!formatted) throw new Error(`Unable to format quantity for ${uiParams.symbol}`);
      return formatted;
    }

    // USD amount
    if (uiParams.quantityInUSD) {
      if (!context.currentPrice) throw new Error('currentPrice required to convert quantityInUSD');
      const rawQuantity = parseFloat(uiParams.quantityInUSD) / context.currentPrice;
      const formatted = formatQuantityForSymbol(uiParams.symbol, rawQuantity);
      if (!formatted) throw new Error(`Unable to format quantity for ${uiParams.symbol}`);
      return formatted;
    }

    // Percent of position
    if (uiParams.quantityAsPercent) {
      if (!context.positionSize) throw new Error('positionSize required to convert quantityAsPercent');
      const rawQuantity = (context.positionSize * parseFloat(uiParams.quantityAsPercent)) / 100;
      const formatted = formatQuantityForSymbol(uiParams.symbol, rawQuantity);
      if (!formatted) throw new Error(`Unable to format quantity for ${uiParams.symbol}`);
      return formatted;
    }

    throw new Error('Must provide quantity, quantityInUSD, or quantityAsPercent');
  };

  // Helper: Format price
  const formatPrice = (price: string): string => {
    const formatted = formatPriceForSymbol(uiParams.symbol, parseFloat(price));
    if (!formatted) throw new Error(`Unable to format price for ${uiParams.symbol}`);
    return formatted;
  };

  // Common fields
  const baseParams = {
    symbol: uiParams.symbol,
    side: uiParams.side,
    reduceOnly: uiParams.reduceOnly,
    positionSide: uiParams.positionSide,
    workingType: uiParams.workingType,
    priceProtect: uiParams.priceProtect,
    newClientOrderId: uiParams.newClientOrderId,
    newOrderRespType: uiParams.newOrderRespType,
  };

  // Handle each order type separately (discriminated union)
  switch (uiParams.type) {
    case 'MARKET':
      return CreateOrderAPIParamsSchema.parse({
        ...baseParams,
        type: 'MARKET',
        quantity: resolveQuantity(),
      });

    case 'LIMIT':
      return CreateOrderAPIParamsSchema.parse({
        ...baseParams,
        type: 'LIMIT',
        quantity: resolveQuantity(),
        price: formatPrice(uiParams.price),
        timeInForce: uiParams.timeInForce || 'GTC',
      });

    case 'STOP':
    case 'TAKE_PROFIT':
      return CreateOrderAPIParamsSchema.parse({
        ...baseParams,
        type: uiParams.type,
        quantity: resolveQuantity(),
        price: formatPrice(uiParams.price),
        stopPrice: formatPrice(uiParams.stopPrice),
        timeInForce: uiParams.timeInForce || 'GTC',
      });

    case 'STOP_MARKET':
    case 'TAKE_PROFIT_MARKET': {
      const quantity = uiParams.closePosition === 'true' ? undefined : resolveQuantity();

      // When closePosition is set, don't send reduceOnly (they're mutually exclusive)
      const params = uiParams.closePosition === 'true'
        ? {
            symbol: uiParams.symbol,
            side: uiParams.side,
            positionSide: uiParams.positionSide,
            workingType: uiParams.workingType,
            priceProtect: uiParams.priceProtect,
            newClientOrderId: uiParams.newClientOrderId,
            newOrderRespType: uiParams.newOrderRespType,
          }
        : baseParams;

      return CreateOrderAPIParamsSchema.parse({
        ...params,
        type: uiParams.type,
        quantity,
        stopPrice: formatPrice(uiParams.stopPrice),
        closePosition: uiParams.closePosition,
      });
    }

    case 'TRAILING_STOP_MARKET':
      return CreateOrderAPIParamsSchema.parse({
        ...baseParams,
        type: 'TRAILING_STOP_MARKET',
        quantity: resolveQuantity(),
        callbackRate: uiParams.callbackRate,
        activationPrice: uiParams.activationPrice,
      });

    default:
      throw new Error(`Unsupported order type: ${(uiParams as any).type}`);
  }
}

/**
 * Get risk level for an operation
 * Used to determine if passphrase is required
 */
export function getOperationRiskLevel(op: AsterWriteOp): 'low' | 'medium' | 'high' {
  switch (op.operation) {
    case 'CANCEL_ORDER':
    case 'CANCEL_ALL_ORDERS':
      return 'low'; // Cancelling is safe

    case 'CREATE_ORDER':
      // Market orders with large values are high risk
      if (op.params.type === 'MARKET' && op.params.quantityInUSD) {
        const value = parseFloat(op.params.quantityInUSD);
        if (value > 1000) return 'high'; // >$1000 USDT
        if (value > 100) return 'medium'; // >$100 USDT
      }
      // TP/SL orders are medium risk
      if (op.params.type.includes('TAKE_PROFIT') || op.params.type.includes('STOP')) {
        return 'medium';
      }
      return 'medium';

    case 'CLOSE_POSITION':
      return 'medium'; // Closing position is medium risk

    case 'BATCH_ORDERS':
      return 'high'; // Multiple orders at once = high risk

    case 'SET_LEVERAGE':
      // Changing leverage on existing position is high risk
      return op.metadata?.hasOpenPosition ? 'high' : 'medium';

    case 'SET_MARGIN_TYPE':
      return 'medium'; // Changing margin type

    case 'SET_MULTI_ASSETS_MARGIN':
      return 'medium'; // Account-wide setting

    case 'MODIFY_ISOLATED_MARGIN':
      // Reducing margin increases liquidation risk
      return op.params.type === '2' ? 'high' : 'medium';

    case 'CREATE_SPOT_ORDER':
      // Spot orders are lower risk (no leverage)
      if (op.params.type === 'MARKET' && op.params.quantityInUSD) {
        const value = parseFloat(op.params.quantityInUSD);
        if (value > 1000) return 'medium'; // >$1000 USDT (spot has no leverage)
        if (value > 100) return 'low'; // >$100 USDT
      }
      return 'low'; // Spot trading is generally low risk

    case 'CANCEL_SPOT_ORDER':
      return 'low'; // Cancelling is safe

    default:
      return 'high'; // Unknown = high risk
  }
}

/**
 * Generate human-readable description of operation
 * Used in confirmation dialogs
 */
export function getOperationDescription(op: AsterWriteOp): string {
  switch (op.operation) {
    case 'CREATE_ORDER':
      if (op.metadata?.action) return op.metadata.action;

      const side = op.params.side === 'BUY' ? 'Long' : 'Short';
      const type = op.params.type.replace(/_/g, ' ');
      return `${side} ${op.params.symbol} (${type})`;

    case 'CANCEL_ORDER':
      return `Cancel Order #${op.params.orderId} (${op.params.symbol})`;

    case 'CANCEL_ALL_ORDERS':
      const count = op.metadata?.orderCount || '?';
      return `Cancel All Orders (${count}) - ${op.params.symbol}`;

    case 'CLOSE_POSITION':
      const pct = op.params.percentage === 100 ? 'All' : `${op.params.percentage}%`;
      return `Close ${pct} - ${op.params.symbol}`;

    case 'BATCH_ORDERS':
      return op.metadata?.description || `Batch ${op.params.orders.length} Orders`;

    case 'SET_LEVERAGE':
      const prev = op.metadata?.previousLeverage;
      return prev
        ? `Change Leverage: ${prev}x → ${op.params.leverage}x (${op.params.symbol})`
        : `Set Leverage to ${op.params.leverage}x (${op.params.symbol})`;

    case 'SET_MARGIN_TYPE':
      const prevMargin = op.metadata?.previousMarginType;
      const newMargin = op.params.marginType === 'ISOLATED' ? 'Isolated' : 'Cross';
      return prevMargin
        ? `Change Margin Type to ${newMargin} (${op.params.symbol})`
        : `Set Margin Type to ${newMargin} (${op.params.symbol})`;

    case 'SET_MULTI_ASSETS_MARGIN':
      const mode = op.params.multiAssetsMargin === 'true' ? 'Multi-Asset Mode' : 'Single-Asset Mode';
      return `Enable ${mode}`;

    case 'MODIFY_ISOLATED_MARGIN':
      if (op.metadata?.actionLabel) return op.metadata.actionLabel;
      const action = op.params.type === '1' ? 'Add' : 'Reduce';
      return `${action} $${op.params.amount} Margin (${op.params.symbol})`;

    case 'CREATE_SPOT_ORDER':
      if (op.metadata?.action) return op.metadata.action;
      const spotSide = op.params.side === 'BUY' ? 'Buy' : 'Sell';
      const spotAsset = op.metadata?.baseAsset || op.params.symbol.replace('USDT', '');
      return `${spotSide} ${spotAsset} (Spot ${op.params.type})`;

    case 'CANCEL_SPOT_ORDER':
      return `Cancel Spot Order #${op.params.orderId} (${op.params.symbol})`;

    default:
      return 'Unknown Operation';
  }
}
