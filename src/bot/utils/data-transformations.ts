/**
 * Data Transformations - Based on DFD Documentation
 * Centralizes all data formatting logic for consistent display across the bot
 */

/**
 * Position Data Transformations
 */

/**
 * Calculate PnL percentage
 * Formula: PnL% = (unRealizedProfit / margin) * 100
 */
export function calculatePnLPercentage(unRealizedProfit: number, margin: number): string {
  if (margin === 0) return '0.00%';
  const pnlPercent = (unRealizedProfit / margin) * 100;
  const sign = pnlPercent >= 0 ? '+' : '';
  return `${sign}${pnlPercent.toFixed(2)}%`;
}

/**
 * Detect position side with emoji
 * Formula: side = positionAmt > 0 ? "LONG" : "SHORT"
 */
export function detectPositionSide(positionAmt: number): string {
  return positionAmt > 0 ? 'LONG 🟢' : 'SHORT 🔴';
}

/**
 * Calculate position value
 * Formula: positionValue = Math.abs(positionAmt) * markPrice
 */
export function calculatePositionValue(positionAmt: number, markPrice: number): string {
  const value = Math.abs(positionAmt) * markPrice;
  return `$${value.toFixed(2)}`;
}

/**
 * Ticker Data Transformations
 */

/**
 * Calculate price change in dollars
 * Formula: change$ = lastPrice - openPrice
 */
export function calculatePriceChange(lastPrice: number, openPrice: number): string {
  const change = lastPrice - openPrice;
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${change.toFixed(2)}`;
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChangePercent(lastPrice: number, openPrice: number): string {
  if (openPrice === 0) return '0.00%';
  const changePercent = ((lastPrice - openPrice) / openPrice) * 100;
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(2)}%`;
}

/**
 * Format volume with M/K notation
 * Formula: volumeDisplay = quoteVolume / 1,000,000
 */
export function formatVolume(quoteVolume: number): string {
  if (quoteVolume >= 1000000) {
    return `${(quoteVolume / 1000000).toFixed(1)}M USDT`;
  } else if (quoteVolume >= 1000) {
    return `${(quoteVolume / 1000).toFixed(1)}K USDT`;
  } else {
    return `${quoteVolume.toFixed(2)} USDT`;
  }
}

/**
 * Order Data Transformations
 */

/**
 * Format order type from UPPER_SNAKE_CASE to Title Case
 * Example: "TAKE_PROFIT_MARKET" -> "Take Profit Market"
 */
export function formatOrderType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format timestamp to localized string
 * Example: 1703123456789 -> "Dec 21, 03:30 AM"
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Calculate order value
 * Formula: orderValue = origQty * price
 */
export function calculateOrderValue(quantity: number, price: number): string {
  const value = quantity * price;
  return `$${value.toFixed(2)} USDT`;
}

/**
 * Margin Management Transformations
 */

/**
 * Calculate new margin after add/remove
 * Formula: newMargin = currentMargin + (type === "ADD" ? amount : -amount)
 */
export function calculateNewMargin(currentMargin: number, amount: number, type: 'ADD' | 'REMOVE'): string {
  const newMargin = currentMargin + (type === 'ADD' ? amount : -amount);
  return `$${newMargin.toFixed(2)}`;
}

/**
 * Format large numbers with K/M/B notation
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(2)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  } else {
    return num.toFixed(2);
  }
}

/**
 * Format USD amount with proper decimals
 */
export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get color emoji based on value (positive/negative)
 */
export function getColorEmoji(value: number): string {
  return value >= 0 ? '🟢' : '🔴';
}

/**
 * Format leverage display
 */
export function formatLeverage(leverage: number): string {
  return `${leverage}x`;
}

/**
 * Format margin mode display
 */
export function formatMarginMode(mode: string): string {
  return mode === 'CROSS' ? 'Cross ⚡' : 'Isolated 🔒';
}
