/**
 * Redis Session Middleware
 * Manages user sessions with Redis storage
 */

import type { Middleware } from 'telegraf';
import type { BotContext } from '../types/context';
import Redis from 'ioredis';

let redis: Redis | null = null;

export function connectRedis(url?: string): Redis {
  if (redis) return redis;
  
  redis = new Redis(url || process.env.REDIS_URL || 'redis://localhost:6379');
  
  redis.on('connect', () => console.log('[Redis] ✅ Connected'));
  redis.on('error', (err) => console.error('[Redis] ❌ Error:', err));
  
  return redis;
}

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('[Redis] Disconnected');
  }
}

/**
 * Create session middleware for Telegraf
 */
export function createSessionMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    
    if (!userId) {
      return next();
    }
    
    const sessionKey = `session:${userId}`;
    const redis = getRedis();
    
    // Load session from Redis
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      try {
        ctx.session = JSON.parse(sessionData);
      } catch (error) {
        console.error('[Session] Failed to parse session data:', error);
        ctx.session = {};
      }
    } else {
      ctx.session = {};
    }
    
    // Save session after processing
    await next();
    
    // Store session back to Redis (24h TTL)
    await redis.setex(sessionKey, 86400, JSON.stringify(ctx.session));
  };
}
