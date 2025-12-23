/**
 * Smart Input Parser
 *
 * Parses flexible user inputs for trading amounts:
 * - "15" → $15 USD (default)
 * - "$15" → $15 USD (explicit)
 * - "15%" → 15% of available margin
 * - "15 BTC" or "15 ASTER" → direct quantity in base asset
 */

export interface ParsedAmount {
  value: number;
  type: 'USD' | 'PERCENT' | 'BASE_ASSET';
}

/**
 * Extract base asset from symbol (e.g., ASTERUSDT → ASTER)
 * All AsterDex futures pairs quote in USDT
 */
function getBaseAsset(symbol: string): string {
  return symbol.replace('USDT', '');
}

/**
 * Normalize a potentially corrupted symbol
 * Fixes issues like BTCUSDTUSDT → BTCUSDT, ETHUSDT → ETHUSDT
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return symbol;
  
  const upper = symbol.toUpperCase();
  
  // Handle double USDT suffix (e.g., BTCUSDTUSDT)
  if (upper.endsWith('USDTUSDT')) {
    return upper.replace(/USDT$/, '');
  }
  
  // Handle double USD suffix (e.g., BTCUSDUSD)
  if (upper.endsWith('USDUSD')) {
    return upper.replace(/USD$/, '');
  }
  
  return upper;
}

/**
 * Parse trading amount input with intelligent detection
 *
 * @param input - User input string
 * @param symbol - Trading pair symbol (e.g., ASTERUSDT, BTCUSDT)
 * @returns Parsed amount with type detection
 *
 * @example
 * parseAmount("15", "ASTERUSDT")       // { value: 15, type: 'USD' }
 * parseAmount("$15", "ASTERUSDT")      // { value: 15, type: 'USD' }
 * parseAmount("15%", "ASTERUSDT")      // { value: 15, type: 'PERCENT' }
 * parseAmount("15 ASTER", "ASTERUSDT") // { value: 15, type: 'BASE_ASSET' }
 * parseAmount("0.5 BTC", "BTCUSDT")    // { value: 0.5, type: 'BASE_ASSET' }
 */
export function parseAmount(input: string, symbol: string): ParsedAmount | null {
  const trimmed = input.trim();

  // Empty input
  if (!trimmed) return null;

  const baseAsset = getBaseAsset(symbol);

  // Pattern: percentage (15%, 15 %)
  if (trimmed.includes('%')) {
    const match = trimmed.match(/^([\d.]+)\s*%$/);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0 && value <= 100) {
        return { value, type: 'PERCENT' };
      }
    }
    return null; // Invalid percentage format
  }

  // Pattern: explicit USD ($15, $ 15)
  if (trimmed.startsWith('$')) {
    const match = trimmed.match(/^\$\s*([\d.]+)$/);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        return { value, type: 'USD' };
      }
    }
    return null; // Invalid USD format
  }

  // Pattern: base asset quantity (15 BTC, 15 ASTER, 0.5BTC)
  // First check if user specified ANY asset symbol
  const anyAssetPattern = /^([\d.]+)\s*([A-Z]+)$/i;
  const anyAssetMatch = trimmed.match(anyAssetPattern);
  if (anyAssetMatch) {
    const value = parseFloat(anyAssetMatch[1]);
    const specifiedAsset = anyAssetMatch[2].toUpperCase();

    // Validate it matches the current trading pair's base asset
    if (specifiedAsset !== baseAsset) {
      // User specified wrong asset (e.g., "15 ETH" on BTCUSDT)
      return null;
    }

    if (!isNaN(value) && value > 0) {
      return { value, type: 'BASE_ASSET' };
    }
    return null; // Invalid base asset quantity
  }

  // Pattern: plain number (15, 15.5) → Default to USD
  const plainNumberMatch = trimmed.match(/^([\d.]+)$/);
  if (plainNumberMatch) {
    const value = parseFloat(plainNumberMatch[1]);
    if (!isNaN(value) && value > 0) {
      return { value, type: 'USD' };
    }
  }

  return null; // Unrecognized format
}

/**
 * Format parsed amount for display in confirmation
 */
export function formatParsedAmount(parsed: ParsedAmount, symbol: string): string {
  switch (parsed.type) {
    case 'USD':
      return `$${parsed.value.toFixed(2)} USDT`;
    case 'PERCENT':
      return `${parsed.value}% of position`;
    case 'BASE_ASSET':
      const baseAsset = getBaseAsset(symbol);
      return `${parsed.value} ${baseAsset}`;
  }
}

/**
 * Convert parsed amount to CreateOrderUIParams field
 */
export function parsedAmountToParams(parsed: ParsedAmount): {
  quantity?: string;
  quantityInUSD?: string;
  quantityAsPercent?: string;
} {
  switch (parsed.type) {
    case 'USD':
      return { quantityInUSD: parsed.value.toString() };
    case 'PERCENT':
      return { quantityAsPercent: parsed.value.toString() };
    case 'BASE_ASSET':
      return { quantity: parsed.value.toString() };
  }
}
