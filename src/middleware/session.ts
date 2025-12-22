/**
 * Redis-based session middleware for Telegraf
 * Functional style
 */
import { session } from 'telegraf';
import { BotContext, SessionData } from '../types/context';
import { getRedis } from '../db/redis';

/**
 * Session store using Redis
 */
const sessionStore = {
  async get(key: string): Promise<SessionData | undefined> {
    const redis = getRedis();
    const data = await redis.get(`session:${key}`);
    return data ? JSON.parse(data) : undefined;
  },

  async set(key: string, data: SessionData): Promise<void> {
    const redis = getRedis();
    // Session expires after 30 days
    await redis.set(`session:${key}`, JSON.stringify(data), 'EX', 60 * 60 * 24 * 30);
  },

  async delete(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`session:${key}`);
  },
};

/**
 * Create session middleware
 */
export function createSessionMiddleware() {
  return session<SessionData, BotContext>({
    getSessionKey: (ctx) => {
      // Use telegram user ID as session key
      return ctx.from?.id.toString() ?? 'unknown';
    },
    store: sessionStore,
  });
}
