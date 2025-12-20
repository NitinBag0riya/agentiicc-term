/**
 * Exchange Info Cache Service
 * Fetches and caches exchange info via Universal API
 */
import { UniversalApiService } from './universal-api.service';
import fs from 'fs';

export interface SymbolInfo {
  symbol: string;
  name?: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  minQuantity?: string;
  maxQuantity?: string;
  tickSize?: string;
  stepSize?: string;
  exchange: string;
}

// In-memory cache
let assetsCache: Record<string, SymbolInfo[]> = {};
let lastFetchTime = 0;
let fetchIntervalId: NodeJS.Timeout | null = null;

const FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch assets for an exchange
 */
async function fetchAssets(exchange: string): Promise<SymbolInfo[]> {
  try {
    const response = await UniversalApiService.getAssets(exchange);
    const assets = response.data || [];
    console.log(`[ExchangeInfo] ✅ Fetched ${assets.length} assets for ${exchange}`);
    return assets.map((a: any) => ({ ...a, exchange }));
  } catch (error: any) {
    console.error(`[ExchangeInfo] ❌ Failed to fetch assets for ${exchange}:`, error.message);
    return [];
  }
}

/**
 * Fetch all exchange info
 */
async function fetchAllExchangeInfo(): Promise<void> {
  console.log('[ExchangeInfo] 📥 Fetching exchange info...');

  const exchanges = ['aster', 'hyperliquid'];
  for (const ex of exchanges) {
    assetsCache[ex] = await fetchAssets(ex);
  }

  lastFetchTime = Date.now();
  console.log('[ExchangeInfo] ✅ Exchange info cached');
}

/**
 * Start the exchange info service
 */
export async function startExchangeInfoService(): Promise<void> {
  console.log('[ExchangeInfo] 🚀 Starting exchange info service...');

  await fetchAllExchangeInfo();

  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
  }

  fetchIntervalId = setInterval(() => {
    fetchAllExchangeInfo().catch((error) => {
      console.error('[ExchangeInfo] ❌ Periodic fetch failed:', error);
    });
  }, FETCH_INTERVAL_MS);
}

/**
 * Stop the exchange info service
 */
export function stopExchangeInfoService(): void {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
    fetchIntervalId = null;
  }
}

/**
 * Get symbols that are currently trading
 */
export function getTradingSymbols(exchange: string): string[] {
  return (assetsCache[exchange] || [])
    .filter(s => s.status === 'TRADING' || s.status === 'active')
    .map(s => s.symbol);
}

/**
 * Get symbol info
 */
export function getSymbolInfo(symbol: string, exchange: string): SymbolInfo | undefined {
  return (assetsCache[exchange] || []).find(s => s.symbol === symbol);
}

/**
 * Check if a symbol exists and is trading
 */
export function isValidSymbol(symbol: string, exchange: string): boolean {
  const info = getSymbolInfo(symbol, exchange);
  return !!info && (info.status === 'TRADING' || info.status === 'active');
}

export function getLastFetchTime(): number {
  return lastFetchTime;
}

// Note: Legacy compatibility exports were removed.
// All consumers should use the exchange-parameterized versions.
