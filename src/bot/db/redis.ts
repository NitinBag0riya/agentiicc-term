/**
 * Redis connection for sessions and low-latency operations
 * Functional style - no classes
 */
import Redis from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Connect to Redis
 */
export async function connectRedis(url?: string): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  // Support both URL and separate host/port/password env vars
  if (process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST;
    const port = parseInt(process.env.REDIS_PORT || '6379');
    const password = process.env.REDIS_PASSWORD;

    console.log('[Redis] Connecting to:', `${host}:${port}`);

    redisClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  } else {
    const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('[Redis] Connecting to:', redisUrl);

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  // Test connection
  await redisClient.ping();
  console.log('[Redis] ✅ Connected successfully');

  // Error handling
  redisClient.on('error', (err) => {
    console.error('[Redis] ❌ Error:', err);
  });

  redisClient.on('reconnecting', () => {
    console.log('[Redis] 🔄 Reconnecting...');
  });

  return redisClient;
}

/**
 * Get Redis client
 */
export function getRedis(): Redis {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Disconnected');
  }
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return redisClient?.status === 'ready';
}
