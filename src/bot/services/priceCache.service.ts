/**
 * Price Cache Service
 * 
 * Simple in-memory cache for ticker data to avoid rate limits.
 * Adapted from legacy for multi-exchange support.
 */

export interface CachedTicker {
    symbol: string;
    price: string;
    change24h: string;
    high24h: string;
    low24h: string;
    volume24h: string;
    timestamp: number;
}

// In-memory cache per exchange
const tickerCache: Map<string, Map<string, CachedTicker>> = new Map();

// Cache TTL (30 seconds - fresh enough for trading, avoids rate limits)
const CACHE_TTL_MS = 30 * 1000;

/**
 * Get cached ticker for a symbol
 */
export function getCachedTicker(exchange: string, symbol: string): CachedTicker | null {
    const exchangeCache = tickerCache.get(exchange);
    if (!exchangeCache) return null;

    const cached = exchangeCache.get(symbol);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        exchangeCache.delete(symbol);
        return null;
    }

    return cached;
}

/**
 * Set cached ticker for a symbol
 */
export function setCachedTicker(exchange: string, symbol: string, ticker: Omit<CachedTicker, 'timestamp'>): void {
    if (!tickerCache.has(exchange)) {
        tickerCache.set(exchange, new Map());
    }

    const exchangeCache = tickerCache.get(exchange)!;
    exchangeCache.set(symbol, {
        ...ticker,
        timestamp: Date.now()
    });
}

/**
 * Get all cached tickers for an exchange
 */
export function getAllCachedTickers(exchange: string): CachedTicker[] {
    const exchangeCache = tickerCache.get(exchange);
    if (!exchangeCache) return [];

    const now = Date.now();
    const valid: CachedTicker[] = [];

    for (const [symbol, ticker] of exchangeCache.entries()) {
        if (now - ticker.timestamp <= CACHE_TTL_MS) {
            valid.push(ticker);
        } else {
            exchangeCache.delete(symbol);
        }
    }

    return valid;
}

/**
 * Clear cache for an exchange
 */
export function clearCache(exchange?: string): void {
    if (exchange) {
        tickerCache.delete(exchange);
    } else {
        tickerCache.clear();
    }
}

/**
 * Check if we have a fresh cached ticker
 */
export function hasFreshTicker(exchange: string, symbol: string): boolean {
    return getCachedTicker(exchange, symbol) !== null;
}
