/**
 * Redis Key Management - Centralized
 *
 * All Redis keys used in the application are defined here.
 * This provides:
 * 1. Single source of truth for all Redis keys
 * 2. Type-safe key generation
 * 3. Easy auditing of what data we store
 * 4. Consistent naming conventions
 */

import { Redis } from 'ioredis';

/**
 * Key Naming Convention:
 * - GLOBAL keys: namespace:feature (e.g., asterdex:rate_limit)
 * - USER keys: namespace:{userId} (e.g., session:123456)
 * - ENTITY keys: namespace:{entityId}:{optional} (e.g., trades:apiKey:all)
 */

// ==================== GLOBAL KEYS ====================

/**
 * Rate limiting - IP-based (affects all users)
 */
export const GLOBAL_KEYS = {
  RATE_LIMIT: 'asterdex:rate_limit',
  RATE_LIMIT_COUNT: 'asterdex:rate_limit:429_count',
  IP_BAN: 'asterdex:ip_banned',
} as const;

// ==================== USER-SCOPED KEYS ====================

/**
 * Session keys - per Telegram user
 */
export const sessionKey = (telegramId: number): string => {
  return `session:${telegramId}`;
};

/**
 * User preferences - per database user
 */
export const userPrefsKey = (userId: number): string => {
  return `prefs:${userId}`;
};

/**
 * Pending write operation - stored while waiting for user confirmation
 * Format: pending_op:{telegramId}:{operationId}
 * TTL: 5 minutes (operation expires if not confirmed)
 */
export const pendingOpKey = (telegramId: number, operationId: string): string => {
  return `pending_op:${telegramId}:${operationId}`;
};

// ==================== API-SCOPED KEYS ====================

/**
 * Trade history cache - per API key
 * Key uses API key (not userId) because trades belong to the exchange account
 */
export const tradesCacheKey = (apiKey: string, symbol?: string): string => {
  return `trades:${apiKey}:${symbol || 'all'}`;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get JSON from Redis
 */
export async function getJSON<T>(redis: Redis, key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Set JSON in Redis with optional TTL
 */
export async function setJSON<T>(
  redis: Redis,
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const json = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.set(key, json, 'EX', ttlSeconds);
  } else {
    await redis.set(key, json);
  }
}

/**
 * Delete key(s) from Redis
 */
export async function deleteKeys(redis: Redis, ...keys: string[]): Promise<void> {
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Check if key exists
 */
export async function keyExists(redis: Redis, key: string): Promise<boolean> {
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Get TTL (time to live) for a key
 */
export async function getTTL(redis: Redis, key: string): Promise<number> {
  return await redis.ttl(key);
}

// ==================== KEY DOCUMENTATION ====================

/**
 * Redis Key Registry
 *
 * All keys used in the application:
 *
 * GLOBAL (shared by all users):
 * - asterdex:rate_limit              string   IP rate limit timestamp
 * - asterdex:rate_limit:429_count    string   Consecutive 429 error count
 * - asterdex:ip_banned               string   IP ban flag ("true")
 *
 * PER USER (Telegram):
 * - session:{telegramId}             JSON     User session state (30d TTL)
 * - prefs:{userId}                   JSON     User preferences (no TTL)
 * - pending_op:{telegramId}:{opId}   JSON     Pending write operation (5m TTL)
 *
 * PER API KEY:
 * - trades:{apiKey}:all              JSON     All trade history (30d TTL)
 * - trades:{apiKey}:{symbol}         JSON     Symbol-specific trades (30d TTL)
 *
 * TEST KEYS:
 * - test:connection                  string   Connection test (10s TTL)
 * - session:test                     JSON     Session test (60s TTL)
 */
