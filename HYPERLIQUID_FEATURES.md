# Hyperliquid Adapter - Advanced Features Guide

## Overview

The Hyperliquid adapter now supports all advanced trading features matching the Aster adapter, including:

- ✅ Market Orders (aggressive limit IOC)
- ✅ Limit Orders (GTC, IOC, ALO/Post-Only)
- ✅ Stop-Loss Orders (STOP_MARKET, STOP_LIMIT)
- ✅ Take-Profit Orders (TAKE_PROFIT_MARKET, TAKE_PROFIT_LIMIT)
- ✅ Trailing Stop Orders
- ✅ TP/SL Attachment (automatic conditional orders)
- ✅ Reduce-Only Orders
- ✅ Cancel All Orders

## Order Types

### 1. Market Orders

Market orders are executed as aggressive limit orders with IOC (Immediate or Cancel) to ensure immediate execution.

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'MARKET',
  quantity: '0.01',
});
```

**Implementation**: Uses current market price +5% for buys, -5% for sells with IOC time-in-force.

### 2. Limit Orders

Standard limit orders with various time-in-force options.

#### GTC (Good Till Cancel) - Default

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3000',
});
```

#### Post-Only (ALO - Add Liquidity Only)

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3000',
  postOnly: true, // Ensures order is maker-only
});
```

#### IOC (Immediate or Cancel)

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3000',
  timeInForce: 'IOC',
});
```

### 3. Stop-Loss Orders

Trigger orders that execute when price reaches a specified level.

#### Stop-Market

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'STOP_MARKET',
  quantity: '0.01',
  triggerPrice: '2900', // Triggers at this price
  reduceOnly: true, // Only closes positions
});
```

#### Stop-Limit

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'STOP_LIMIT',
  quantity: '0.01',
  triggerPrice: '2900', // Triggers at this price
  price: '2895', // Executes as limit at this price
  reduceOnly: true,
});
```

### 4. Take-Profit Orders

Similar to stop-loss but for profit-taking.

#### Take-Profit Market

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'TAKE_PROFIT_MARKET',
  quantity: '0.01',
  triggerPrice: '3500',
  reduceOnly: true,
});
```

#### Take-Profit Limit

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'TAKE_PROFIT_LIMIT',
  quantity: '0.01',
  triggerPrice: '3500',
  price: '3505',
  reduceOnly: true,
});
```

### 5. Trailing Stop Orders

Dynamic stop-loss that trails the market price.

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'TRAILING_STOP_MARKET',
  quantity: '0.01',
  trailingDelta: '2.5', // 2.5% trailing distance
  reduceOnly: true,
});
```

### 6. Orders with TP/SL Attachment

Automatically attach take-profit and stop-loss orders to your entry order.

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3000',
  takeProfit: '3300', // Auto-place TP at $3300
  stopLoss: '2850', // Auto-place SL at $2850
});
```

**Result**: Creates 3 orders:

1. Entry limit order at $3000
2. Take-profit sell order at $3300 (reduce-only)
3. Stop-loss sell order at $2850 (reduce-only)

## Order Management

### Get Open Orders

```typescript
// All open orders
const allOrders = await adapter.getOpenOrders();

// Orders for specific symbol
const ethOrders = await adapter.getOpenOrders('ETH');
```

### Cancel Single Order

```typescript
const result = await adapter.cancelOrder(orderId, symbol);
console.log(result.status); // 'CANCELED' or 'FAILED'
```

### Cancel All Orders

```typescript
// Cancel all orders for a symbol
const result = await adapter.cancelAllOrders('ETH');
console.log(result.message); // "Canceled 5 orders"

// Cancel all orders across all symbols
const result = await adapter.cancelAllOrders();
```

## Advanced Parameters

### Reduce-Only

Ensures order only closes existing positions, never opens new ones.

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'SELL',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3200',
  reduceOnly: true, // Only reduces position size
});
```

### Leverage

Set leverage for the position (if supported by exchange).

```typescript
await adapter.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  type: 'LIMIT',
  quantity: '0.01',
  price: '3000',
  leverage: '10', // 10x leverage
});
```

## Testing

Run the comprehensive test suite:

```bash
# Basic functionality test
bun run test:hyperliquid

# Advanced features test
bun run test:hyperliquid:advanced
```

## API Compatibility

The Hyperliquid adapter implements the same interface as the Aster adapter, ensuring:

- ✅ Drop-in replacement capability
- ✅ Unified API across all exchanges
- ✅ Consistent parameter naming
- ✅ Standardized response formats

## Error Handling

All order placement methods include comprehensive error handling:

```typescript
try {
    const order = await adapter.placeOrder({...});
    console.log('Order placed:', order.orderId);
} catch (error) {
    console.error('Order failed:', error.message);
    // Error message includes specific rejection reason
}
```

Common error scenarios:

- Invalid price (not divisible by tick size)
- Insufficient balance
- Order value below minimum ($10 for Hyperliquid)
- Missing required parameters (e.g., triggerPrice for stop orders)

## Performance Notes

- **Market Orders**: Executed as IOC limit orders for immediate fill
- **TP/SL Attachment**: Placed asynchronously (non-blocking)
- **Cancel All**: Uses parallel execution for multiple cancellations
- **WebSocket**: Auto-connects on first order placement

## Hyperliquid-Specific Considerations

1. **Minimum Order Value**: $10 USD minimum per order
2. **Tick Size**: Varies by asset (e.g., ETH: 0.0001)
3. **Step Size**: Minimum quantity increment (e.g., ETH: 0.001)
4. **Market Orders**: Implemented as aggressive limit + IOC
5. **FOK Orders**: Not supported, automatically converted to IOC

## Examples

See `src/test-hyperliquid-advanced.ts` for comprehensive examples of all features.
