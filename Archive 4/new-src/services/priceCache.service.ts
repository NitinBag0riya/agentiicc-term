/**
 * Price Cache Service
 * Primary: WebSocket real-time prices (1 second updates)
 * Fallback: HTTP polling every 10 minutes
 */
import axios from 'axios';
import WebSocket from 'ws';

export interface TickerPrice {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
  volume: string;
  quoteVolume: string;
}

// In-memory cache
let spotPrices: TickerPrice[] = [];
let futuresPrices: TickerPrice[] = [];
let lastFetchTime = 0;

// WebSocket state
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let is24HourReconnectScheduled = false;
let fallbackIntervalId: NodeJS.Timeout | null = null;

const SPOT_BASE_URL = 'https://sapi.asterdex.com';
const FUTURES_BASE_URL = 'https://fapi.asterdex.com';
const WS_BASE_URL = 'wss://fstream.asterdex.com';
const FALLBACK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const WS_24HR_MS = 24 * 60 * 60 * 1000; // 24 hours
const RECONNECT_DELAY_MS = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Fetch spot ticker prices via HTTP
 */
async function fetchSpotPrices(): Promise<TickerPrice[] | null> {
  try {
    const response = await axios.get<TickerPrice[]>(`${SPOT_BASE_URL}/api/v1/ticker/24hr`, {
      timeout: 10000,
    });
    console.log(`[PriceCache] ✅ Fetched spot prices via HTTP (${response.data.length} symbols)`);
    return response.data;
  } catch (error: unknown) {
    console.error('[PriceCache] ❌ Failed to fetch spot prices:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Fetch futures ticker prices via HTTP (fallback)
 */
async function fetchFuturesPrices(): Promise<TickerPrice[] | null> {
  try {
    const response = await axios.get<TickerPrice[]>(`${FUTURES_BASE_URL}/fapi/v1/ticker/24hr`, {
      timeout: 10000,
    });
    console.log(`[PriceCache] ✅ Fetched futures prices via HTTP (${response.data.length} symbols)`);
    return response.data;
  } catch (error: unknown) {
    console.error('[PriceCache] ❌ Failed to fetch futures prices:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Fetch both spot and futures prices via HTTP
 */
async function fetchAllPricesViaHTTP(): Promise<void> {
  console.log('[PriceCache] 📥 Fetching prices via HTTP (fallback)...');

  const [spot, futures] = await Promise.all([
    fetchSpotPrices(),
    fetchFuturesPrices(),
  ]);

  if (spot) {
    spotPrices = spot;
  }

  if (futures) {
    futuresPrices = futures;
  }

  lastFetchTime = Date.now();
  console.log('[PriceCache] ✅ HTTP prices cached');
}

/**
 * Connect to WebSocket for real-time futures prices
 */
function connectWebSocket(): void {
  // Clean up existing connection
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }

  console.log('[PriceCache] 🔌 Connecting to WebSocket...');

  // Stream: !ticker@arr = all market tickers @ 1 second updates
  ws = new WebSocket(`${WS_BASE_URL}/ws/!ticker@arr`);

  ws.on('open', () => {
    console.log('[PriceCache] ✅ WebSocket connected');
    reconnectAttempts = 0;

    // Schedule 24-hour reconnect (API requirement: connection valid for 24 hours)
    if (!is24HourReconnectScheduled) {
      is24HourReconnectScheduled = true;
      setTimeout(() => {
        console.log('[PriceCache] ⏰ 24-hour WebSocket reconnect');
        is24HourReconnectScheduled = false;
        connectWebSocket();
      }, WS_24HR_MS);
    }
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString());

      // Expecting array of ticker objects
      if (Array.isArray(message)) {
        // Map WebSocket format to our TickerPrice interface
        const updatedTickers: TickerPrice[] = message.map((ticker: any) => ({
          symbol: ticker.s,                    // Symbol
          lastPrice: ticker.c,                 // Close price (last price)
          priceChangePercent: ticker.P,        // Price change percent
          highPrice: ticker.h,                 // High price
          lowPrice: ticker.l,                  // Low price
          openPrice: ticker.o,                 // Open price
          volume: ticker.v,                    // Volume
          quoteVolume: ticker.q,               // Quote volume
        }));

        // MERGE updates into existing cache (WebSocket only sends changed tickers!)
        // Create a map of existing prices for fast lookup
        const priceMap = new Map(futuresPrices.map(t => [t.symbol, t]));

        // Update existing or add new tickers
        for (const ticker of updatedTickers) {
          priceMap.set(ticker.symbol, ticker);
        }

        // Convert map back to array
        futuresPrices = Array.from(priceMap.values());
        lastFetchTime = Date.now();

        // Log first update only
        if (reconnectAttempts === 0) {
          console.log(`[PriceCache] 📊 WebSocket prices updated (${updatedTickers.length} changed, ${futuresPrices.length} total)`);
          reconnectAttempts = -1; // Prevent multiple logs
        }
      }
    } catch (error) {
      console.error('[PriceCache] ❌ Failed to parse WebSocket message:', error);
    }
  });

  ws.on('ping', () => {
    // Server sends ping every 5 mins, we auto-respond with pong
    // ws library handles this automatically
  });

  ws.on('error', (error) => {
    console.error('[PriceCache] ❌ WebSocket error:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`[PriceCache] ❌ WebSocket closed (code: ${code}, reason: ${reason.toString()})`);

    // Attempt reconnection with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttempts, 5); // Max 25 seconds

      console.log(`[PriceCache] 🔄 Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

      reconnectTimer = setTimeout(() => {
        connectWebSocket();
      }, delay);
    } else {
      console.error('[PriceCache] ❌ Max reconnect attempts reached. Relying on HTTP fallback.');
    }
  });
}

/**
 * Start the price cache service
 * Primary: WebSocket for real-time futures prices
 * Fallback: HTTP polling every 10 minutes
 */
export async function startPriceCacheService(): Promise<void> {
  console.log('[PriceCache] 🚀 Starting price cache service...');

  // Initial fetch via HTTP (populate cache immediately)
  await fetchAllPricesViaHTTP();

  // Start WebSocket for real-time futures prices
  connectWebSocket();

  // HTTP fallback: Fetch prices every 10 minutes (in case WS fails)
  fallbackIntervalId = setInterval(() => {
    // Only fetch via HTTP if WebSocket is not connected or unhealthy
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[PriceCache] ⚠️ WebSocket down, using HTTP fallback');
      fetchAllPricesViaHTTP();
    } else {
      // Still fetch spot prices via HTTP (no WebSocket for spot)
      fetchSpotPrices().then(spot => {
        if (spot) spotPrices = spot;
      });
    }
  }, FALLBACK_INTERVAL_MS);

  console.log('[PriceCache] ✅ Service started (WebSocket + HTTP fallback)');
}

/**
 * Stop the price cache service
 */
export function stopPriceCacheService(): void {
  // Close WebSocket
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }

  // Clear timers
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (fallbackIntervalId) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }

  console.log('[PriceCache] 🛑 Service stopped');
}

/**
 * Get cached spot prices
 */
export function getSpotPrices(): TickerPrice[] {
  return spotPrices;
}

/**
 * Get cached futures prices
 */
export function getFuturesPrices(): TickerPrice[] {
  return futuresPrices;
}

/**
 * Get spot price for a specific symbol
 */
export function getSpotPrice(symbol: string): string | undefined {
  const ticker = spotPrices.find(t => t.symbol === symbol);
  return ticker?.lastPrice;
}

/**
 * Get futures price for a specific symbol
 */
export function getFuturesPrice(symbol: string): string | undefined {
  const ticker = futuresPrices.find(t => t.symbol === symbol);
  return ticker?.lastPrice;
}

/**
 * Get full futures ticker for a specific symbol
 */
export function getFuturesTicker(symbol: string): TickerPrice | undefined {
  return futuresPrices.find(t => t.symbol === symbol);
}

/**
 * Get last fetch timestamp
 */
export function getLastFetchTime(): number {
  return lastFetchTime;
}

/**
 * Check if WebSocket is healthy
 */
export function isWebSocketHealthy(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
