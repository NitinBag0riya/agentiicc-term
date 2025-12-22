/**
 * Quantity Formatter Utility
 *
 * Formats quantities according to exchange LOT_SIZE filters to avoid precision errors.
 *
 * API Error -1111: "Precision is over the maximum defined for this asset"
 * This happens when quantity has too many decimal places or doesn't align with stepSize.
 *
 * Example:
 * - stepSize = "0.1" → quantity must be 23.8, not 23.847
 * - stepSize = "1" → quantity must be 24, not 23.8
 * - stepSize = "0.01" → quantity must be 23.85, not 23.847
 */

import { getFuturesSymbol, type FuturesSymbolInfo } from '../services/exchangeInfo.service';

interface LotSizeFilter {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

interface PriceFilter {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

interface MinNotionalFilter {
  filterType: 'MIN_NOTIONAL';
  notional: string;
}

/**
 * Get LOT_SIZE filter for a symbol
 */
export function getLotSizeFilter(symbol: string): LotSizeFilter | null {
  const symbolInfo = getFuturesSymbol(symbol);
  if (!symbolInfo) return null;

  const filter = symbolInfo.filters.find(
    f => f.filterType === 'LOT_SIZE'
  ) as LotSizeFilter | undefined;

  return filter || null;
}

/**
 * Get PRICE_FILTER for a symbol
 */
export function getPriceFilter(symbol: string): PriceFilter | null {
  const symbolInfo = getFuturesSymbol(symbol);
  if (!symbolInfo) return null;

  const filter = symbolInfo.filters.find(
    f => f.filterType === 'PRICE_FILTER'
  ) as PriceFilter | undefined;

  return filter || null;
}

/**
 * Get MIN_NOTIONAL filter for a symbol
 */
export function getMinNotionalFilter(symbol: string): MinNotionalFilter | null {
  const symbolInfo = getFuturesSymbol(symbol);
  if (!symbolInfo) return null;

  const filter = symbolInfo.filters.find(
    f => f.filterType === 'MIN_NOTIONAL'
  ) as MinNotionalFilter | undefined;

  return filter || null;
}

/**
 * Count decimal places in a string number
 */
function countDecimals(value: string): number {
  const parts = value.split('.');
  return parts.length > 1 ? parts[1].length : 0;
}

/**
 * Format quantity to match stepSize requirements
 *
 * Rules from API docs:
 * - quantity >= minQty
 * - quantity <= maxQty
 * - (quantity - minQty) % stepSize == 0
 *
 * @param quantity - Raw quantity (e.g., 23.847619)
 * @param stepSize - Step size from LOT_SIZE filter (e.g., "0.1")
 * @param minQty - Min quantity from LOT_SIZE filter (e.g., "0.001")
 * @returns Formatted quantity string that meets exchange requirements
 */
export function formatQuantityToStepSize(
  quantity: number,
  stepSize: string,
  minQty: string
): string {
  const step = parseFloat(stepSize);
  const min = parseFloat(minQty);

  // Calculate number of steps from minQty
  const stepsFromMin = Math.round((quantity - min) / step);

  // Calculate exact quantity that aligns with stepSize
  const aligned = min + (stepsFromMin * step);

  // Format with same decimal places as stepSize
  const decimals = countDecimals(stepSize);

  return aligned.toFixed(decimals);
}

/**
 * Format price to match tickSize requirements
 *
 * Similar to quantity formatting but for prices
 */
export function formatPriceToTickSize(
  price: number,
  tickSize: string,
  minPrice: string
): string {
  const tick = parseFloat(tickSize);
  const min = parseFloat(minPrice);

  // Calculate number of ticks from minPrice
  const ticksFromMin = Math.round((price - min) / tick);

  // Calculate exact price that aligns with tickSize
  const aligned = min + (ticksFromMin * tick);

  // Format with same decimal places as tickSize
  const decimals = countDecimals(tickSize);

  return aligned.toFixed(decimals);
}

/**
 * Format quantity for a specific symbol
 * Gets filters automatically and formats quantity
 *
 * @param symbol - Trading pair symbol (e.g., "ASTERUSDT")
 * @param quantity - Raw quantity to format
 * @returns Formatted quantity string or null if symbol not found
 */
export function formatQuantityForSymbol(
  symbol: string,
  quantity: number
): string | null {
  const filter = getLotSizeFilter(symbol);
  if (!filter) {
    console.error(`[QuantityFormatter] No LOT_SIZE filter found for ${symbol}`);
    return null;
  }

  const formatted = formatQuantityToStepSize(quantity, filter.stepSize, filter.minQty);

  console.log('[QuantityFormatter] Formatted quantity:', {
    symbol,
    rawQuantity: quantity,
    stepSize: filter.stepSize,
    minQty: filter.minQty,
    maxQty: filter.maxQty,
    formattedQuantity: formatted,
  });

  return formatted;
}

/**
 * Format price for a specific symbol
 * Gets filters automatically and formats price
 */
export function formatPriceForSymbol(
  symbol: string,
  price: number
): string | null {
  const filter = getPriceFilter(symbol);
  if (!filter) {
    console.error(`[QuantityFormatter] No PRICE_FILTER found for ${symbol}`);
    return null;
  }

  const formatted = formatPriceToTickSize(price, filter.tickSize, filter.minPrice);

  console.log('[QuantityFormatter] Formatted price:', {
    symbol,
    rawPrice: price,
    tickSize: filter.tickSize,
    minPrice: filter.minPrice,
    maxPrice: filter.maxPrice,
    formattedPrice: formatted,
  });

  return formatted;
}

/**
 * Validate quantity against LOT_SIZE filter
 * Returns validation result with error message if invalid
 */
export function validateQuantity(
  symbol: string,
  quantity: string
): { valid: boolean; error?: string } {
  const filter = getLotSizeFilter(symbol);
  if (!filter) {
    return { valid: false, error: `Symbol ${symbol} not found in exchange info` };
  }

  const qty = parseFloat(quantity);
  const min = parseFloat(filter.minQty);
  const max = parseFloat(filter.maxQty);
  const step = parseFloat(filter.stepSize);

  // Check min/max
  if (qty < min) {
    return { valid: false, error: `Quantity ${quantity} below minimum ${filter.minQty}` };
  }
  if (qty > max) {
    return { valid: false, error: `Quantity ${quantity} above maximum ${filter.maxQty}` };
  }

  // Check stepSize alignment
  const remainder = (qty - min) % step;
  if (Math.abs(remainder) > 1e-8) { // Use small epsilon for floating point comparison
    return {
      valid: false,
      error: `Quantity ${quantity} doesn't align with stepSize ${filter.stepSize}`
    };
  }

  return { valid: true };
}

/**
 * Validate price against PRICE_FILTER
 */
export function validatePrice(
  symbol: string,
  price: string
): { valid: boolean; error?: string } {
  const filter = getPriceFilter(symbol);
  if (!filter) {
    return { valid: false, error: `Symbol ${symbol} not found in exchange info` };
  }

  const prc = parseFloat(price);
  const min = parseFloat(filter.minPrice);
  const max = parseFloat(filter.maxPrice);
  const tick = parseFloat(filter.tickSize);

  // Check min/max
  if (prc < min) {
    return { valid: false, error: `Price ${price} below minimum ${filter.minPrice}` };
  }
  if (prc > max) {
    return { valid: false, error: `Price ${price} above maximum ${filter.maxPrice}` };
  }

  // Check tickSize alignment
  const remainder = (prc - min) % tick;
  if (Math.abs(remainder) > 1e-8) {
    return {
      valid: false,
      error: `Price ${price} doesn't align with tickSize ${filter.tickSize}`
    };
  }

  return { valid: true };
}

/**
 * Check if order meets MIN_NOTIONAL requirement
 * notional = quantity * price
 */
export function validateNotional(
  symbol: string,
  quantity: number,
  price: number
): { valid: boolean; error?: string } {
  const filter = getMinNotionalFilter(symbol);
  if (!filter) {
    // If no filter, notional check not required
    return { valid: true };
  }

  const notional = quantity * price;
  const minNotional = parseFloat(filter.notional);

  if (notional < minNotional) {
    return {
      valid: false,
      error: `Order value ${notional.toFixed(2)} USDT below minimum ${minNotional} USDT`,
    };
  }

  return { valid: true };
}
