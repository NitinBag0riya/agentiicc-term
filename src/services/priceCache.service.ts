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
let hyperliquidPrices: TickerPrice[] = []; // Hyperliquid price cache
let lastFetchTime = 0;
let lastHyperliquidFetchTime = 0;

// WebSocket state
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let is24HourReconnectScheduled = false;
let fallbackIntervalId: NodeJS.Timeout | null = null;
let hyperliquidIntervalId: NodeJS.Timeout | null = null;

const SPOT_BASE_URL = 'https://sapi.asterdex.com';
const FUTURES_BASE_URL = 'https://fapi.asterdex.com';
const WS_BASE_URL = 'wss://fstream.asterdex.com';
const HYPERLIQUID_API_URL = 'https://api.hyperliquid.xyz/info';
const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws';  // Real-time WebSocket
const FALLBACK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const WS_24HR_MS = 24 * 60 * 60 * 1000; // 24 hours
const RECONNECT_DELAY_MS = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

// Hyperliquid WebSocket state
let hlWs: WebSocket | null = null;
let hlReconnectTimer: NodeJS.Timeout | null = null;
let hlReconnectAttempts = 0;

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
 * Fetch Hyperliquid prices via HTTP
 */
async function fetchHyperliquidPrices(): Promise<TickerPrice[] | null> {
  try {
    // Get all mids (current prices)
    const [midsResponse, metaResponse] = await Promise.all([
      axios.post(HYPERLIQUID_API_URL, { type: 'allMids' }, { timeout: 10000 }),
      axios.post(HYPERLIQUID_API_URL, { type: 'meta' }, { timeout: 10000 })
    ]);

    const mids = midsResponse.data; // { "BTC": "94000.5", "ETH": "3400.2", ... }
    const meta = metaResponse.data; // { universe: [{ name: "BTC", ... }, ...] }

    if (!mids || typeof mids !== 'object') {
      throw new Error('Invalid mids response');
    }

    // Transform to TickerPrice format
    const prices: TickerPrice[] = Object.entries(mids).map(([symbol, price]) => ({
      symbol: symbol, // Hyperliquid uses short symbols like "BTC", "ETH"
      lastPrice: String(price),
      priceChangePercent: '0', // Not available in allMids
      highPrice: String(price),
      lowPrice: String(price),
      openPrice: String(price),
      volume: '0',
      quoteVolume: '0'
    }));

    console.log(`[PriceCache] ✅ Fetched Hyperliquid prices (${prices.length} symbols)`);
    return prices;
  } catch (error: unknown) {
    console.error('[PriceCache] ❌ Failed to fetch Hyperliquid prices:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Connect to Hyperliquid WebSocket for real-time price updates
 * Subscribes to allMids for all asset mid-prices
 */
function connectHyperliquidWebSocket(): void {
  console.log('[PriceCache] 🔌 Connecting to Hyperliquid WebSocket...');

  hlWs = new WebSocket(HYPERLIQUID_WS_URL);

  hlWs.on('open', () => {
    console.log('[PriceCache] ✅ Hyperliquid WebSocket connected');
    hlReconnectAttempts = 0;

    // Subscribe to allMids for real-time price updates
    const subscribeMsg = JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'allMids' }
    });
    hlWs!.send(subscribeMsg);
    console.log('[PriceCache] 📡 Subscribed to Hyperliquid allMids');
  });

  hlWs.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Handle allMids updates
      if (msg.channel === 'allMids' && msg.data && msg.data.mids) {
        const mids = msg.data.mids;
        
        // Transform to TickerPrice format
        hyperliquidPrices = Object.entries(mids).map(([symbol, price]) => ({
          symbol: symbol,
          lastPrice: String(price),
          priceChangePercent: '0',
          highPrice: String(price),
          lowPrice: String(price),
          openPrice: String(price),
          volume: '0',
          quoteVolume: '0'
        }));
        
        lastHyperliquidFetchTime = Date.now();
        
        // Log first update
        if (hlReconnectAttempts === 0) {
          console.log(`[PriceCache] 📊 Hyperliquid WebSocket prices updated (${hyperliquidPrices.length} symbols)`);
          hlReconnectAttempts = -1; // Prevent multiple logs
        }
      }
    } catch (error) {
      console.error('[PriceCache] ❌ Failed to parse Hyperliquid WebSocket message:', error);
    }
  });

  hlWs.on('error', (error) => {
    console.error('[PriceCache] ❌ Hyperliquid WebSocket error:', error.message);
  });

  hlWs.on('close', (code, reason) => {
    console.log(`[PriceCache] ❌ Hyperliquid WebSocket closed (code: ${code})`);

    // Attempt reconnection with exponential backoff
    if (hlReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      hlReconnectAttempts++;
      const delay = RECONNECT_DELAY_MS * Math.min(hlReconnectAttempts, 5);

      console.log(`[PriceCache] 🔄 Hyperliquid reconnecting in ${delay / 1000}s (attempt ${hlReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

      hlReconnectTimer = setTimeout(() => {
        connectHyperliquidWebSocket();
      }, delay);
    } else {
      console.error('[PriceCache] ❌ Hyperliquid max reconnect attempts reached. Will use HTTP fallback.');
    }
  });
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
 * Primary: WebSocket for real-time futures prices (Aster)
 * Fallback: HTTP polling every 10 minutes (Aster)
 * Hyperliquid: WebSocket real-time (allMids subscription)
 */
export async function startPriceCacheService(): Promise<void> {
  console.log('[PriceCache] 🚀 Starting price cache service...');

  // Initial fetch via HTTP (populate cache immediately)
  await fetchAllPricesViaHTTP();
  
  // Initial Hyperliquid fetch (before WebSocket connects)
  const hlPrices = await fetchHyperliquidPrices();
  if (hlPrices) {
    hyperliquidPrices = hlPrices;
    lastHyperliquidFetchTime = Date.now();
  }

  // Start WebSocket for real-time futures prices (Aster)
  connectWebSocket();

  // Start WebSocket for real-time Hyperliquid prices
  connectHyperliquidWebSocket();

  // HTTP fallback: Fetch Aster prices every 10 minutes (in case WS fails)
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
    
    // Hyperliquid HTTP fallback (if WS is down)
    if (!hlWs || hlWs.readyState !== WebSocket.OPEN) {
      console.log('[PriceCache] ⚠️ Hyperliquid WebSocket down, using HTTP fallback');
      fetchHyperliquidPrices().then(prices => {
        if (prices) {
          hyperliquidPrices = prices;
          lastHyperliquidFetchTime = Date.now();
        }
      });
    }
  }, FALLBACK_INTERVAL_MS);

  console.log('[PriceCache] ✅ Service started (Aster WS + Hyperliquid WS + HTTP fallback)');
}

/**
 * Stop the price cache service
 */
export function stopPriceCacheService(): void {
  // Close Aster WebSocket
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }

  // Close Hyperliquid WebSocket
  if (hlWs) {
    hlWs.removeAllListeners();
    hlWs.close();
    hlWs = null;
  }

  // Clear Aster reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Clear Hyperliquid reconnect timer
  if (hlReconnectTimer) {
    clearTimeout(hlReconnectTimer);
    hlReconnectTimer = null;
  }

  if (fallbackIntervalId) {
    clearInterval(fallbackIntervalId);
    fallbackIntervalId = null;
  }

  // Remove unused hyperliquidIntervalId (now using WebSocket)
  if (hyperliquidIntervalId) {
    clearInterval(hyperliquidIntervalId);
    hyperliquidIntervalId = null;
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
 * @param symbol - Symbol to look up
 * @param exchange - Exchange to get price from ('aster' | 'hyperliquid')
 */
export function getFuturesTicker(symbol: string, exchange: string = 'aster'): TickerPrice | undefined {
  if (exchange === 'hyperliquid') {
    // Hyperliquid uses short symbols (BTC, ETH) while Aster uses BTCUSDT
    const normalizedSymbol = symbol.replace(/USDT$|USD$/, '');
    return hyperliquidPrices.find(t => t.symbol === normalizedSymbol || t.symbol === symbol);
  }
  return futuresPrices.find(t => t.symbol === symbol);
}

/**
 * Get Hyperliquid prices
 */
export function getHyperliquidPrices(): TickerPrice[] {
  return hyperliquidPrices;
}

/**
 * Get Hyperliquid price for a specific symbol
 */
export function getHyperliquidPrice(symbol: string): string | undefined {
  const normalizedSymbol = symbol.replace(/USDT$|USD$/, '');
  const ticker = hyperliquidPrices.find(t => t.symbol === normalizedSymbol || t.symbol === symbol);
  return ticker?.lastPrice;
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
