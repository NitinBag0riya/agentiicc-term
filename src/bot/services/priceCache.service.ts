/**
 * Price Cache Service
 * Fetches and caches prices via Universal API
 */
import { UniversalApiService } from './universal-api.service';

export interface TickerPrice {
  symbol: string;
  lastPrice: string;
  priceChangePercent?: string;
  highPrice?: string;
  lowPrice?: string;
  openPrice?: string;
  volume?: string;
  quoteVolume?: string;
  exchange: string;
}

// In-memory cache: exchange -> symbol -> TickerPrice
let pricesCache: Record<string, Record<string, TickerPrice>> = {};
let lastFetchTime = 0;
let fetchIntervalId: NodeJS.Timeout | null = null;

const FETCH_INTERVAL_MS = 30000; // 30 seconds (aggressive polling since we removed WS for now)

/**
 * Fetch all prices for an exchange
 */
async function fetchAllPrices(exchange: string): Promise<TickerPrice[]> {
  try {
    // Note: This assumes Universal API has a /tickers or similar. 
    // If not, we fall back to individual or simplified fetch.
    const response = await UniversalApiService.getAssets(exchange);
    const assets = response.data || [];
    
    // Convert assets to TickerPrice format
    return assets.map((a: any) => ({
      symbol: a.symbol,
      lastPrice: a.lastPrice || '0.0',
      priceChangePercent: a.priceChangePercent,
      exchange
    }));
  } catch (error: any) {
    console.error(`[PriceCache] ❌ Failed to fetch prices for ${exchange}:`, error.message);
    return [];
  }
}

/**
 * Refresh all prices
 */
async function refreshPrices(): Promise<void> {
  const exchanges = ['aster', 'hyperliquid'];
  
  for (const ex of exchanges) {
    const tickers = await fetchAllPrices(ex);
    if (!pricesCache[ex]) pricesCache[ex] = {};
    
    for (const t of tickers) {
      pricesCache[ex][t.symbol] = t;
    }
  }
  
  lastFetchTime = Date.now();
}

/**
 * Start the price cache service
 */
export async function startPriceCacheService(): Promise<void> {
  console.log('[PriceCache] 🚀 Starting price cache service...');
  
  await refreshPrices();

  fetchIntervalId = setInterval(() => {
    refreshPrices().catch(err => console.error('[PriceCache] Periodic refresh failed:', err));
  }, FETCH_INTERVAL_MS);
}

/**
 * Stop the price cache service
 */
export function stopPriceCacheService(): void {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
    fetchIntervalId = null;
  }
}

/**
 * Get price for a symbol
 */
export function getPrice(symbol: string, exchange: string): string | undefined {
  return pricesCache[exchange]?.[symbol]?.lastPrice;
}

/**
 * Get full ticker
 */
export function getTicker(symbol: string, exchange: string): TickerPrice | undefined {
  return pricesCache[exchange]?.[symbol];
}

export function getLastFetchTime(): number {
  return lastFetchTime;
}

// Note: Legacy compatibility exports were removed.
// All prices and tickers must be requested with an explicit exchange parameter.
export function isWebSocketHealthy(): boolean { return false; } // WS removed for pure Universal API alignment
/**
 * Get all spot prices (for all exchanges)
 */
export function getSpotPrices(): Record<string, Record<string, TickerPrice>> {
  return pricesCache;
}
