/**
 * Quantity Formatter Utility
 *
 * Formats quantities according to exchange LOT_SIZE filters to avoid precision errors.
 * Simplified version - uses basic decimal precision instead of full exchange info.
 */

/**
 * Count decimal places in a string number
 */
function countDecimals(value: string): number {
    const parts = value.split('.');
    return parts.length > 1 ? parts[1].length : 0;
}

/**
 * Format quantity to specific decimal places
 */
export function formatQuantity(quantity: number, decimals: number = 5): string {
    return quantity.toFixed(decimals);
}

/**
 * Format price to specific decimal places
 */
export function formatPrice(price: number, decimals: number = 4): string {
    return price.toFixed(decimals);
}

/**
 * Get appropriate decimal places for a symbol
 * Common patterns:
 * - BTC: 5 decimals (0.00001)
 * - ETH: 4 decimals (0.0001)
 * - Small caps: 0-2 decimals
 */
export function getQuantityDecimals(symbol: string): number {
    const base = symbol.replace(/USDT$|USD$|PERP$/, '').toUpperCase();

    // High-value assets need more precision
    if (['BTC', 'ETH', 'WBTC', 'WETH'].includes(base)) {
        return 5;
    }

    // Mid-value assets
    if (['SOL', 'AVAX', 'LINK', 'DOT', 'NEAR'].includes(base)) {
        return 3;
    }

    // Default for most assets
    return 2;
}

/**
 * Get appropriate decimal places for price
 */
export function getPriceDecimals(symbol: string): number {
    const base = symbol.replace(/USDT$|USD$|PERP$/, '').toUpperCase();

    // High-value assets have higher prices, need fewer decimals
    if (['BTC'].includes(base)) {
        return 2;
    }

    if (['ETH', 'WBTC', 'WETH'].includes(base)) {
        return 2;
    }

    // Mid-value assets
    if (['SOL', 'AVAX', 'LINK', 'DOT', 'NEAR'].includes(base)) {
        return 3;
    }

    // Default - small cap assets need more price precision
    return 4;
}

/**
 * Format quantity for a specific symbol
 */
export function formatQuantityForSymbol(symbol: string, quantity: number): string {
    const decimals = getQuantityDecimals(symbol);
    return formatQuantity(quantity, decimals);
}

/**
 * Format price for a specific symbol
 */
export function formatPriceForSymbol(symbol: string, price: number): string {
    const decimals = getPriceDecimals(symbol);
    return formatPrice(price, decimals);
}

/**
 * Calculate quantity from USD amount for a symbol
 */
export function usdToQuantity(usdAmount: number, price: number, symbol: string): string {
    const rawQuantity = usdAmount / price;
    return formatQuantityForSymbol(symbol, rawQuantity);
}

/**
 * Calculate USD value from quantity
 */
export function quantityToUsd(quantity: number, price: number): string {
    const usdValue = quantity * price;
    return usdValue.toFixed(2);
}
