/**
 * Exchange Info Cache Service
 * Fetches and caches exchange info from AsterDex on startup and every 10 minutes
 */
import axios from 'axios';
import fs from 'fs';

interface SymbolFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  stepSize?: string;
  minQty?: string;
  maxQty?: string;
  notional?: string;
  [key: string]: any;
}

export interface SpotSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: string[];
  filters: SymbolFilter[];
}

export interface FuturesSymbolInfo {
  symbol: string;
  pair: string;
  contractType: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
  filters: SymbolFilter[];
  orderTypes: string[];
  timeInForce: string[];
}

interface SpotExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: SpotSymbolInfo[];
}

interface FuturesExchangeInfo {
  timezone: string;
  serverTime: number;
  futuresType: string;
  symbols: FuturesSymbolInfo[];
}

// In-memory cache
let spotExchangeInfo: SpotExchangeInfo | null = null;
let futuresExchangeInfo: FuturesExchangeInfo | null = null;
let lastFetchTime = 0;
let fetchIntervalId: NodeJS.Timeout | null = null;

const FETCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const SPOT_BASE_URL = 'https://sapi.asterdex.com';
const FUTURES_BASE_URL = 'https://fapi.asterdex.com';

/**
 * Fetch spot exchange info
 */
async function fetchSpotExchangeInfo(): Promise<SpotExchangeInfo | null> {
  try {
    const response = await axios.get<SpotExchangeInfo>(`${SPOT_BASE_URL}/api/v1/exchangeInfo`, {
      timeout: 10000,
    });
    console.log(`[ExchangeInfo] ✅ Fetched spot exchange info (${response.data.symbols.length} symbols)`);
    return response.data;
  } catch (error: unknown) {
    console.error('[ExchangeInfo] ❌ Failed to fetch spot exchange info:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Fetch futures exchange info
 */
async function fetchFuturesExchangeInfo(): Promise<FuturesExchangeInfo | null> {
  try {
    const response = await axios.get<FuturesExchangeInfo>(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`, {
      timeout: 10000,
    });
    console.log(`[ExchangeInfo] ✅ Fetched futures exchange info (${response.data.symbols.length} symbols)`);
    fs.writeFileSync('futures_exchange_info.json', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: unknown) {
    console.error('[ExchangeInfo] ❌ Failed to fetch futures exchange info:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Fetch both spot and futures exchange info
 */
async function fetchAllExchangeInfo(): Promise<void> {
  console.log('[ExchangeInfo] 📥 Fetching exchange info...');

  const [spot, futures] = await Promise.all([
    fetchSpotExchangeInfo(),
    fetchFuturesExchangeInfo(),
  ]);

  if (spot) {
    spotExchangeInfo = spot;
  }

  if (futures) {
    futuresExchangeInfo = futures;
  }

  lastFetchTime = Date.now();
  console.log('[ExchangeInfo] ✅ Exchange info cached');
}

/**
 * Start the exchange info service
 * Fetches immediately and then every 10 minutes
 */
export async function startExchangeInfoService(): Promise<void> {
  console.log('[ExchangeInfo] 🚀 Starting exchange info service...');

  // Initial fetch
  await fetchAllExchangeInfo();

  // Set up periodic refresh
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
  }

  fetchIntervalId = setInterval(() => {
    fetchAllExchangeInfo().catch((error) => {
      console.error('[ExchangeInfo] ❌ Periodic fetch failed:', error);
    });
  }, FETCH_INTERVAL_MS);

  console.log('[ExchangeInfo] ✅ Service started (refresh every 10 minutes)');
}

/**
 * Stop the exchange info service
 */
export function stopExchangeInfoService(): void {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
    fetchIntervalId = null;
    console.log('[ExchangeInfo] 🛑 Service stopped');
  }
}

/**
 * Get cached spot exchange info
 */
export function getSpotExchangeInfo(): SpotExchangeInfo | null {
  return spotExchangeInfo;
}

/**
 * Get cached futures exchange info
 */
export function getFuturesExchangeInfo(): FuturesExchangeInfo | null {
  return futuresExchangeInfo;
}

/**
 * Get spot symbols that are currently trading
 */
export function getSpotTradingSymbols(): string[] {
  if (!spotExchangeInfo) return [];
  return spotExchangeInfo.symbols
    .filter(s => s.status === 'TRADING')
    .map(s => s.symbol);
}

/**
 * Get futures symbols that are currently trading
 */
export function getFuturesTradingSymbols(): string[] {
  if (!futuresExchangeInfo) return [];
  return futuresExchangeInfo.symbols
    .filter(s => s.status === 'TRADING')
    .map(s => s.symbol);
}

/**
 * Get spot symbol info by symbol name
 */
export function getSpotSymbol(symbol: string): SpotSymbolInfo | undefined {
  if (!spotExchangeInfo) return undefined;
  return spotExchangeInfo.symbols.find(s => s.symbol === symbol);
}

/**
 * Get futures symbol info by symbol name
 */
export function getFuturesSymbol(symbol: string): FuturesSymbolInfo | undefined {
  if (!futuresExchangeInfo) return undefined;
  return futuresExchangeInfo.symbols.find(s => s.symbol === symbol);
}

/**
 * Check if a spot symbol exists and is trading
 */
export function isValidSpotSymbol(symbol: string): boolean {
  const info = getSpotSymbol(symbol);
  return info?.status === 'TRADING';
}

/**
 * Check if a futures symbol exists and is trading
 */
export function isValidFuturesSymbol(symbol: string): boolean {
  const info = getFuturesSymbol(symbol);
  return info?.status === 'TRADING';
}

/**
 * Get last fetch timestamp
 */
export function getLastFetchTime(): number {
  return lastFetchTime;
}
