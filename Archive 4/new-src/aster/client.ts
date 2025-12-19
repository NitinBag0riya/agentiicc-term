/**
 * Centralized AsterDex API Service
 *
 * Key Features:
 * - Rate limit management via Redis (shared across all API keys since limits are per IP)
 * - Exponential backoff: 1, 2, 4, 8, 16 seconds, then fail permanently
 * - Immediate failure on 418 (I'm a Teapot) to avoid IP bans
 * - Credential validation during linking
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Redis } from 'ioredis';
import { AsterSigner } from './signing';
import fs from 'fs';
import type {
  ExchangeInfo,
  AccountInfo,
  PositionInfo,
  NewOrderRequest,
  OrderResponse,
  SymbolInfo
} from '../types/api';

// Rate limit Redis keys
/**
 * Rate Limiting & IP Ban Redis Keys
 *
 * IMPORTANT: These are GLOBAL (not per-user or per-API-key) because:
 * - AsterDex rate limits are IP-based, not API-key-based
 * - 429 (Too Many Requests) = Your IP is making too many requests
 * - 418 (I'm a Teapot) = Your IP is banned
 * - All bot instances share the same server IP
 * - If one user triggers rate limit, ALL users are affected (by design)
 *
 * This is correct behavior - the entire server needs to back off when IP is limited.
 */
const RATE_LIMIT_KEY = 'asterdex:rate_limit';
const RATE_LIMIT_429_COUNT_KEY = 'asterdex:rate_limit:429_count';
const IP_BAN_KEY = 'asterdex:ip_banned';

// Backoff delays in milliseconds
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000];
const MAX_RETRIES = BACKOFF_DELAYS.length;

export interface AsterClientConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  redis: Redis;
}

export class AsterDexError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AsterDexError';
  }
}

/**
 * Centralized AsterDex API Client with Redis-based rate limiting
 */
export async function createAsterClient(config: AsterClientConfig) {
  const { baseUrl, apiKey, apiSecret, redis } = config;

  const axios = createAxiosInstance(baseUrl, apiKey);

  return {
    // Account operations
    getAccountInfo: () => getAccountInfo(axios, apiSecret, redis),
    getPositions: () => getPositions(axios, apiSecret, redis),
    getSpotAccount: () => getSpotAccount(axios, apiSecret, redis),
    getUserTrades: (symbol?: string) => getUserTrades(axios, apiSecret, redis, symbol),
    getOpenOrders: (symbol?: string) => getOpenOrders(axios, apiSecret, redis, symbol),

    // Trading operations (Futures)
    createOrder: (params: Partial<NewOrderRequest>) =>
      createOrder(axios, apiSecret, redis, params),
    closePosition: (symbol: string, percentage: number = 100) =>
      closePosition(axios, apiSecret, redis, symbol, percentage),
    cancelOrder: (symbol: string, orderId: number) =>
      cancelOrder(axios, apiSecret, redis, symbol, orderId),
    cancelAllOrders: (symbol: string) =>
      cancelAllOrders(axios, apiSecret, redis, symbol),

    // Spot trading operations
    createSpotOrder: (params: any) =>
      createSpotOrder(axios, apiSecret, redis, params),
    cancelSpotOrder: (symbol: string, orderId: number) =>
      cancelSpotOrder(axios, apiSecret, redis, symbol, orderId),

    // Leverage & Margin operations
    setLeverage: (symbol: string, leverage: number) =>
      setLeverage(axios, apiSecret, redis, symbol, leverage),
    setMarginType: (symbol: string, marginType: 'ISOLATED' | 'CROSSED') =>
      setMarginType(axios, apiSecret, redis, symbol, marginType),
    modifyPositionMargin: (symbol: string, amount: string, type: '1' | '2', positionSide?: 'BOTH' | 'LONG' | 'SHORT') =>
      modifyPositionMargin(axios, apiSecret, redis, symbol, amount, type, positionSide),

    // Multi-assets margin (account-wide)
    getMultiAssetsMargin: () => getMultiAssetsMargin(axios, apiSecret, redis),
    setMultiAssetsMargin: (multiAssetsMargin: 'true' | 'false') =>
      setMultiAssetsMargin(axios, apiSecret, redis, multiAssetsMargin),

    // Market data
    getExchangeInfo: () => getExchangeInfo(axios, redis),
    get24hrTicker: (symbol: string) => get24hrTicker(axios, redis, symbol),

    // Validation
    validateCredentials: () => validateCredentials(axios, apiSecret, redis),
    testConnectivity: () => testConnectivity(axios, redis),
  };
}

export type AsterClient = Awaited<ReturnType<typeof createAsterClient>>;

/**
 * Create Axios instance with proper headers
 */
function createAxiosInstance(baseUrl: string, apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AsterBot/2.0.0',
    },
  });
}

/**
 * Check if we're currently rate limited via Redis
 */
async function checkRateLimit(redis: Redis): Promise<void> {
  // Check if IP is banned
  const isBanned = await redis.get(IP_BAN_KEY);
  if (isBanned === 'true') {
    throw new AsterDexError(
      'IP is banned by AsterDex. Please contact support.',
      'IP_BANNED',
      418,
      false
    );
  }

  // Check if we're currently in backoff
  const rateLimitUntil = await redis.get(RATE_LIMIT_KEY);
  if (rateLimitUntil) {
    const waitUntil = parseInt(rateLimitUntil, 10);
    const now = Date.now();

    if (now < waitUntil) {
      const waitSeconds = Math.ceil((waitUntil - now) / 1000);
      throw new AsterDexError(
        `Rate limited. Please wait ${waitSeconds} seconds.`,
        'RATE_LIMITED',
        429,
        true
      );
    } else {
      // Rate limit expired, clear it
      await redis.del(RATE_LIMIT_KEY);
      await redis.del(RATE_LIMIT_429_COUNT_KEY);
    }
  }
}

/**
 * Handle 429 rate limit error with exponential backoff
 */
async function handle429Error(redis: Redis, retryAfter?: number): Promise<void> {
  // Increment 429 counter
  const count = await redis.incr(RATE_LIMIT_429_COUNT_KEY);

  if (count > MAX_RETRIES) {
    // Failed permanently
    await redis.del(RATE_LIMIT_KEY);
    await redis.del(RATE_LIMIT_429_COUNT_KEY);
    throw new AsterDexError(
      'Rate limit exceeded permanently. Too many retries.',
      'RATE_LIMIT_EXCEEDED',
      429,
      false
    );
  }

  // Calculate backoff delay (exponential: 1, 2, 4, 8, 16 seconds)
  const backoffDelay = BACKOFF_DELAYS[count - 1] || BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1];
  const delay = retryAfter ? Math.max(retryAfter * 1000, backoffDelay) : backoffDelay;

  // Set rate limit in Redis with expiry
  const waitUntil = Date.now() + delay;
  await redis.set(RATE_LIMIT_KEY, waitUntil.toString(), 'PX', delay);

  console.warn(`[AsterDex] Rate limited. Backoff attempt ${count}/${MAX_RETRIES}. Wait ${delay}ms`);

  throw new AsterDexError(
    `Rate limited. Retry ${count}/${MAX_RETRIES}. Wait ${Math.ceil(delay / 1000)}s.`,
    'RATE_LIMITED',
    429,
    true
  );
}

/**
 * Handle 418 I'm a Teapot error (immediate ban)
 */
async function handle418Error(redis: Redis): Promise<never> {
  // Set IP ban flag in Redis (expires after 1 hour)
  await redis.set(IP_BAN_KEY, 'true', 'EX', 3600);

  console.error('[AsterDex] 418 I\'m a Teapot received. IP may be banned!');

  throw new AsterDexError(
    'IP banned by AsterDex (418). Please stop making requests and contact support.',
    'IP_BANNED',
    418,
    false
  );
}

/**
 * Execute API request with rate limit handling
 */
async function executeRequest<T>(
  redis: Redis,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check Redis for existing rate limits
  await checkRateLimit(redis);

  try {
    const result = await requestFn();

    // Success - clear any rate limit counters
    await redis.del(RATE_LIMIT_429_COUNT_KEY);

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      // Handle 418 (IP ban) immediately
      if (status === 418) {
        await handle418Error(redis);
      }

      // Handle 429 (rate limit) with exponential backoff
      if (status === 429) {
        const retryAfter = axiosError.response?.headers['retry-after']
          ? parseInt(axiosError.response.headers['retry-after'], 10)
          : undefined;

        await handle429Error(redis, retryAfter);
      }

      // Handle other errors
      interface AsterErrorResponse {
        msg?: string;
      }
      const errorData = axiosError.response?.data as AsterErrorResponse | undefined;
      const message = errorData?.msg || axiosError.message;
      throw new AsterDexError(
        message,
        `HTTP_${status}`,
        status,
        status ? status >= 500 : false
      );
    }

    // Non-Axios errors
    throw new AsterDexError(
      error instanceof Error ? error.message : 'Unknown error',
      'UNKNOWN_ERROR',
      undefined,
      false
    );
  }
}

/**
 * Get account information
 */
async function getAccountInfo(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis
): Promise<AccountInfo> {
  return executeRequest(redis, async () => {
    const signedRequest = AsterSigner.signGetRequest('/fapi/v1/account', {}, apiSecret);
    const response = await axios.get<AccountInfo>(signedRequest.url);
    fs.writeFileSync('account_info.json', JSON.stringify(response.data, null, 2));
    return response.data;
  });
}

/**
 * Get position risk information
 */
async function getPositions(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis
): Promise<PositionInfo[]> {
  return executeRequest(redis, async () => {
    const signedRequest = AsterSigner.signGetRequest('/fapi/v2/positionRisk', {}, apiSecret);
    const response = await axios.get<PositionInfo[]>(signedRequest.url);
    return response.data;
  });
}

/**
 * Get spot account information
 */
async function getSpotAccount(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis
): Promise<{ balances: Array<{ asset: string; free: string; locked: string }> }> {
  return executeRequest(redis, async () => {
    const spotBaseUrl = 'https://sapi.asterdex.com';
    const signedRequest = AsterSigner.signGetRequest('/api/v1/account', {}, apiSecret);

    const spotAxios = axios.create({
      baseURL: spotBaseUrl,
      headers: {
        'X-MBX-APIKEY': axios.defaults.headers['X-MBX-APIKEY'],
        'Content-Type': 'application/json',
      },
    });

    const response = await spotAxios.get<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
      `/api/v1/account?${signedRequest.url.split('?')[1]}`
    );
    return response.data;
  });
}

/**
 * Get user trade history (last 90 days in 7-day chunks)
 */
async function getUserTrades(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol?: string
): Promise<Array<{
  symbol: string;
  id: number;
  orderId: number;
  side: string;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}>> {
  const spotBaseUrl = 'https://sapi.asterdex.com';
  const spotAxios = axios.create({
    baseURL: spotBaseUrl,
    headers: {
      'X-MBX-APIKEY': axios.defaults.headers['X-MBX-APIKEY'],
      'Content-Type': 'application/json',
    },
  });

  interface TradeData {
    symbol: string;
    id: number;
    orderId: number;
    side: string;
    price: string;
    qty: string;
    quoteQty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    buyer: boolean;
    maker: boolean;
  }

  interface TradeCache {
    lastSyncTime: number;
    trades: TradeData[];
  }

  // Generate cache key based on API key and symbol
  const apiKey = axios.defaults.headers['X-MBX-APIKEY'] as string;
  const cacheKey = `trades:${apiKey}:${symbol || 'all'}`;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  try {
    // Try to get cached trades
    const cached = await redis.get(cacheKey);
    let tradeCache: TradeCache | null = null;

    if (cached) {
      tradeCache = JSON.parse(cached);
    }

    const now = Date.now();
    const timeSinceLastSync = tradeCache ? now - tradeCache.lastSyncTime : Infinity;

    // Decide sync strategy based on cache age
    if (!tradeCache || timeSinceLastSync > NINETY_DAYS_MS) {
      // FULL FETCH: No cache or cache too old (>90 days)
      console.log(`[getUserTrades] Full fetch (90 days) - cache age: ${timeSinceLastSync ? Math.floor(timeSinceLastSync / 86400000) : 'none'} days`);

      const allTrades: TradeData[] = [];
      for (let i = 0; i < 13; i++) {
        const endTime = now - (i * SEVEN_DAYS_MS);
        const startTime = endTime - SEVEN_DAYS_MS;

        const params: Record<string, string> = {
          timestamp: Date.now().toString(),
          recvWindow: '60000',
          limit: '1000',
          startTime: startTime.toString(),
          endTime: endTime.toString(),
        };

        if (symbol) params.symbol = symbol;

        const signedRequest = AsterSigner.signGetRequest('/api/v1/userTrades', params, apiSecret);

        try {
          const trades = await executeRequest(redis, async () => {
            const response = await spotAxios.get<TradeData[]>(
              `/api/v1/userTrades?${signedRequest.url.split('?')[1]}`
            );
            return response.data;
          });

          if (trades && trades.length > 0) {
            allTrades.push(...trades);
          }
        } catch (error) {
          if (error instanceof AsterDexError) {
            if (error.code === 'IP_BANNED' || error.code === 'RATE_LIMITED') {
              console.warn(`[getUserTrades] ${error.code} - stopping at week ${i + 1}/13`);
              break;
            }
          }
          continue;
        }
      }

      // Cache the result (30 day TTL)
      const newCache: TradeCache = {
        lastSyncTime: now,
        trades: allTrades.sort((a, b) => a.time - b.time), // Sort by time ascending
      };
      await redis.set(cacheKey, JSON.stringify(newCache), 'EX', 30 * 24 * 60 * 60);

      return allTrades;

    } else if (timeSinceLastSync < SEVEN_DAYS_MS) {
      // INCREMENTAL FETCH: Cache is fresh (<7 days old), only fetch new trades
      console.log(`[getUserTrades] Incremental sync - ${Math.floor(timeSinceLastSync / 60000)} mins since last sync`);

      const params: Record<string, string> = {
        timestamp: Date.now().toString(),
        recvWindow: '60000',
        limit: '1000',
        startTime: tradeCache.lastSyncTime.toString(),
        endTime: now.toString(),
      };

      if (symbol) params.symbol = symbol;

      const signedRequest = AsterSigner.signGetRequest('/api/v1/userTrades', params, apiSecret);

      try {
        const newTrades = await executeRequest(redis, async () => {
          const response = await spotAxios.get<TradeData[]>(
            `/api/v1/userTrades?${signedRequest.url.split('?')[1]}`
          );
          return response.data;
        });

        // Merge new trades with cached trades (deduplicate by id)
        const existingIds = new Set(tradeCache.trades.map(t => t.id));
        const uniqueNewTrades = (newTrades || []).filter(t => !existingIds.has(t.id));
        const allTrades = [...tradeCache.trades, ...uniqueNewTrades].sort((a, b) => a.time - b.time);

        // Update cache
        const updatedCache: TradeCache = {
          lastSyncTime: now,
          trades: allTrades,
        };
        await redis.set(cacheKey, JSON.stringify(updatedCache), 'EX', 30 * 24 * 60 * 60);

        return allTrades;
      } catch (error) {
        // On error, return cached trades
        console.warn('[getUserTrades] Incremental fetch failed, returning cached trades');
        return tradeCache.trades;
      }

    } else {
      // PAGINATED BACKFILL: Cache is 7-90 days old, paginate backwards from lastSyncTime
      const weeksSinceLastSync = Math.ceil(timeSinceLastSync / SEVEN_DAYS_MS);
      console.log(`[getUserTrades] Backfill ${weeksSinceLastSync} weeks since last sync`);

      const allTrades: TradeData[] = [...tradeCache.trades];

      for (let i = 0; i < weeksSinceLastSync; i++) {
        const endTime = tradeCache.lastSyncTime + (i * SEVEN_DAYS_MS);
        const startTime = Math.max(endTime - SEVEN_DAYS_MS, tradeCache.lastSyncTime);

        if (endTime > now) break; // Don't fetch future

        const params: Record<string, string> = {
          timestamp: Date.now().toString(),
          recvWindow: '60000',
          limit: '1000',
          startTime: startTime.toString(),
          endTime: endTime.toString(),
        };

        if (symbol) params.symbol = symbol;

        const signedRequest = AsterSigner.signGetRequest('/api/v1/userTrades', params, apiSecret);

        try {
          const trades = await executeRequest(redis, async () => {
            const response = await spotAxios.get<TradeData[]>(
              `/api/v1/userTrades?${signedRequest.url.split('?')[1]}`
            );
            return response.data;
          });

          if (trades && trades.length > 0) {
            allTrades.push(...trades);
          }
        } catch (error) {
          if (error instanceof AsterDexError) {
            if (error.code === 'IP_BANNED' || error.code === 'RATE_LIMITED') {
              console.warn(`[getUserTrades] ${error.code} - stopping backfill at week ${i + 1}`);
              break;
            }
          }
          continue;
        }
      }

      // Update cache with backfilled trades
      const uniqueTrades = Array.from(
        new Map(allTrades.map(t => [t.id, t])).values()
      ).sort((a, b) => a.time - b.time);

      const updatedCache: TradeCache = {
        lastSyncTime: now,
        trades: uniqueTrades,
      };
      await redis.set(cacheKey, JSON.stringify(updatedCache), 'EX', 30 * 24 * 60 * 60);

      return uniqueTrades;
    }
  } catch (cacheError) {
    // If Redis fails, fall back to direct API fetch (no caching)
    console.warn('[getUserTrades] Cache error, falling back to direct fetch:', cacheError);

    const allTrades: TradeData[] = [];
    const now = Date.now();

    for (let i = 0; i < 13; i++) {
      const endTime = now - (i * SEVEN_DAYS_MS);
      const startTime = endTime - SEVEN_DAYS_MS;

      const params: Record<string, string> = {
        timestamp: Date.now().toString(),
        recvWindow: '60000',
        limit: '1000',
        startTime: startTime.toString(),
        endTime: endTime.toString(),
      };

      if (symbol) params.symbol = symbol;

      const signedRequest = AsterSigner.signGetRequest('/api/v1/userTrades', params, apiSecret);

      try {
        const trades = await executeRequest(redis, async () => {
          const response = await spotAxios.get<TradeData[]>(
            `/api/v1/userTrades?${signedRequest.url.split('?')[1]}`
          );
          return response.data;
        });

        if (trades && trades.length > 0) {
          allTrades.push(...trades);
        }
      } catch (error) {
        if (error instanceof AsterDexError) {
          if (error.code === 'IP_BANNED' || error.code === 'RATE_LIMITED') {
            break;
          }
        }
        continue;
      }
    }

    return allTrades;
  }
}

/**
 * Get open orders
 */
export interface OpenOrder {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: string;
  positionSide: string;
  stopPrice?: string;
  workingType?: string; // CONTRACT_PRICE or MARK_PRICE
  priceProtect: boolean;
  origType: string;
  time: number;
  updateTime: number;
  activatePrice?: string; // For trailing stops
  priceRate?: string; // For trailing stops
  newChainData?: {
    hash: string;
  };
}

async function getOpenOrders(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol?: string
): Promise<OpenOrder[]> {
  return executeRequest(redis, async () => {
    const params = symbol ? { symbol } : {};
    const signedRequest = AsterSigner.signGetRequest('/fapi/v1/openOrders', params, apiSecret);
    const response = await axios.get<OpenOrder[]>(signedRequest.url);
    return response.data;
  });
}

/**
 * Cancel a single order
 */
async function cancelOrder(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  orderId: number
): Promise<any> {
  return executeRequest(redis, async () => {
    const params = { symbol, orderId: orderId.toString() };
    const signedRequest = AsterSigner.signDeleteRequest('/fapi/v1/order', params, apiSecret);

    const response = await axios.delete(signedRequest.url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  });
}

/**
 * Cancel all open orders for a symbol
 */
async function cancelAllOrders(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string
): Promise<any> {
  return executeRequest(redis, async () => {
    const params = { symbol };
    const signedRequest = AsterSigner.signDeleteRequest('/fapi/v1/allOpenOrders', params, apiSecret);

    const response = await axios.delete(signedRequest.url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  });
}

/**
 * Create order
 */
async function createOrder(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  orderParams: Partial<NewOrderRequest>
): Promise<OrderResponse> {
  if (!orderParams.symbol || !orderParams.side || !orderParams.type) {
    throw new AsterDexError(
      'Missing required order parameters: symbol, side, type',
      'INVALID_PARAMS',
      400,
      false
    );
  }

  return executeRequest(redis, async () => {
    const clientOrderId = orderParams.newClientOrderId || AsterSigner.createClientOrderId();

    const params = {
      ...orderParams,
      newClientOrderId: clientOrderId,
      newOrderRespType: 'RESULT' as const,
    };

    const signedRequest = AsterSigner.signPostRequest('/fapi/v1/order', params, apiSecret);
    const formData = new URLSearchParams(signedRequest.queryString);

    const response = await axios.post<OrderResponse>('/fapi/v1/order', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  });
}

/**
 * Close position
 */
async function closePosition(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  percentage: number = 100
): Promise<OrderResponse> {
  return executeRequest(redis, async () => {
    const positions = await getPositions(axios, apiSecret, redis);
    const position = positions.find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

    if (!position) {
      throw new AsterDexError(
        `No open position found for ${symbol}`,
        'NO_POSITION',
        404,
        false
      );
    }

    const positionAmt = Math.abs(parseFloat(position.positionAmt));
    const closeQuantity = (positionAmt * percentage / 100).toString();
    const side = parseFloat(position.positionAmt) > 0 ? 'SELL' : 'BUY';

    const orderParams: Partial<NewOrderRequest> = {
      symbol,
      side: side as 'BUY' | 'SELL',
      type: 'MARKET',
      quantity: closeQuantity,
      reduceOnly: 'true' // API expects STRING not boolean!
    };

    return createOrder(axios, apiSecret, redis, orderParams);
  });
}

/**
 * Create spot order
 *
 * API: POST /api/v1/order
 * For spot trading (no leverage)
 */
async function createSpotOrder(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  orderParams: any
): Promise<any> {
  if (!orderParams.symbol || !orderParams.side || !orderParams.type) {
    throw new AsterDexError(
      'Missing required spot order parameters: symbol, side, type',
      'INVALID_PARAMS',
      400,
      false
    );
  }

  return executeRequest(redis, async () => {
    const clientOrderId = orderParams.newClientOrderId || AsterSigner.createClientOrderId();

    const params = {
      ...orderParams,
      newClientOrderId: clientOrderId,
    };

    // Remove UI helpers before sending to API
    delete params.quantityInUSD;
    delete params.quantityAsPercent;

    const signedRequest = AsterSigner.signPostRequest('/api/v1/order', params, apiSecret);
    const formData = new URLSearchParams(signedRequest.queryString);

    const response = await axios.post('/api/v1/order', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  });
}

/**
 * Cancel spot order
 *
 * API: DELETE /api/v1/order
 */
async function cancelSpotOrder(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  orderId: number
): Promise<any> {
  return executeRequest(redis, async () => {
    const params = {
      symbol,
      orderId,
    };

    const signedRequest = AsterSigner.signDeleteRequest('/api/v1/order', params, apiSecret);

    const response = await axios.delete(signedRequest.url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  });
}

/**
 * Get exchange information
 */
async function getExchangeInfo(
  axios: AxiosInstance,
  redis: Redis
): Promise<ExchangeInfo> {
  return executeRequest(redis, async () => {
    const response = await axios.get<ExchangeInfo>('/fapi/v1/exchangeInfo');
    return response.data;
  });
}

/**
 * Get 24hr ticker
 */
async function get24hrTicker(
  axios: AxiosInstance,
  redis: Redis,
  symbol: string
): Promise<{
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
  volume: string;
  quoteVolume: string;
}> {
  return executeRequest(redis, async () => {
    const response = await axios.get(`/fapi/v1/ticker/24hr?symbol=${symbol}`);
    return response.data;
  });
}

/**
 * Test connectivity
 */
async function testConnectivity(
  axios: AxiosInstance,
  redis: Redis
): Promise<boolean> {
  try {
    await executeRequest(redis, async () => {
      const response = await axios.get('/fapi/v1/ping');
      return response.status === 200;
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Set leverage for a symbol
 * API: POST /fapi/v1/leverage
 */
async function setLeverage(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  leverage: number
): Promise<{ code: number; msg: string }> {
  return executeRequest(redis, async () => {
    const timestamp = Date.now();
    const params = {
      symbol,
      leverage,
      timestamp,
    };

    const signature = AsterSigner.sign(params, apiSecret);
    const response = await axios.post('/fapi/v1/leverage', null, {
      params: { ...params, signature },
    });
    return response.data;
  });
}

/**
 * Set margin type for a symbol
 * API: POST /fapi/v1/marginType
 */
async function setMarginType(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  marginType: 'ISOLATED' | 'CROSSED'
): Promise<{ code: number; msg: string }> {
  return executeRequest(redis, async () => {
    const timestamp = Date.now();
    const params = {
      symbol,
      marginType,
      timestamp,
    };

    const signature = AsterSigner.sign(params, apiSecret);
    const response = await axios.post('/fapi/v1/marginType', null, {
      params: { ...params, signature },
    });
    return response.data;
  });
}

/**
 * Modify position margin (add or reduce) for isolated positions
 * API: POST /fapi/v1/positionMargin
 */
async function modifyPositionMargin(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  symbol: string,
  amount: string,
  type: '1' | '2', // 1 = Add, 2 = Reduce
  positionSide?: 'BOTH' | 'LONG' | 'SHORT'
): Promise<{ amount: number; code: number; msg: string; type: number }> {
  return executeRequest(redis, async () => {
    const timestamp = Date.now();
    const params: any = {
      symbol,
      amount,
      type: parseInt(type),
      timestamp,
    };

    if (positionSide) {
      params.positionSide = positionSide;
    }

    const signature = AsterSigner.sign(params, apiSecret);
    const response = await axios.post('/fapi/v1/positionMargin', null, {
      params: { ...params, signature },
    });
    return response.data;
  });
}

/**
 * Get multi-assets margin mode
 * API: GET /fapi/v1/multiAssetsMargin
 */
async function getMultiAssetsMargin(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis
): Promise<{ multiAssetsMargin: boolean }> {
  return executeRequest(redis, async () => {
    const timestamp = Date.now();
    const params = { timestamp };

    const signature = AsterSigner.sign(params, apiSecret);
    const response = await axios.get('/fapi/v1/multiAssetsMargin', {
      params: { ...params, signature },
    });
    return response.data;
  });
}

/**
 * Set multi-assets margin mode (account-wide)
 * API: POST /fapi/v1/multiAssetsMargin
 */
async function setMultiAssetsMargin(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis,
  multiAssetsMargin: 'true' | 'false'
): Promise<{ code: number; msg: string }> {
  return executeRequest(redis, async () => {
    const timestamp = Date.now();
    const params = {
      multiAssetsMargin,
      timestamp,
    };

    const signature = AsterSigner.sign(params, apiSecret);
    const response = await axios.post('/fapi/v1/multiAssetsMargin', null, {
      params: { ...params, signature },
    });
    return response.data;
  });
}

/**
 * Validate API credentials
 */
async function validateCredentials(
  axios: AxiosInstance,
  apiSecret: string,
  redis: Redis
): Promise<boolean> {
  try {
    await getAccountInfo(axios, apiSecret, redis);
    return true;
  } catch (error) {
    console.error('[AsterDex] Credential validation failed:', error);
    return false;
  }
}
