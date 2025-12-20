/**
 * Referral Middleware
 * Enforces referral code requirement for new users
 */

import type { Middleware } from 'telegraf';
import type { BotContext } from '../types/context';
import { getPostgres } from '../../db/postgres';

/**
 * Check if user needs a referral code
 */
export async function needsReferralCode(telegramId: number): Promise<boolean> {
  const db = getPostgres();
  
  // Check if user exists and is verified
  const result = await db.query(
    'SELECT is_verified FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  
  if (result.rows.length === 0) {
    // New user - needs referral code
    return true;
  }
  
  return !result.rows[0].is_verified;
}

/**
 * Validate referral code
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  referrerId?: number;
  referrerUsername?: string;
}> {
  const db = getPostgres();
  
  const result = await db.query(
    'SELECT id, username FROM users WHERE referral_code = $1 AND is_verified = TRUE',
    [code.toUpperCase()]
  );
  
  if (result.rows.length === 0) {
    return { valid: false };
  }
  
  return {
    valid: true,
    referrerId: result.rows[0].id,
    referrerUsername: result.rows[0].username
  };
}

/**
 * Create user with referral code
 */
export async function createUserWithReferral(
  telegramId: number,
  username: string | null,
  referralCode: string
): Promise<{ success: boolean; ownReferralCode?: string }> {
  const db = getPostgres();
  
  // Validate referral code
  const validation = await validateReferralCode(referralCode);
  if (!validation.valid) {
    return { success: false };
  }
  
  // Generate unique referral code for new user
  const ownCode = generateReferralCode();
  
  try {
    await db.query(
      `INSERT INTO users (telegram_id, username, referral_code, referred_by, is_verified)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (telegram_id) DO UPDATE SET
         referral_code = $3,
         referred_by = $4,
         is_verified = TRUE`,
      [telegramId, username, ownCode, validation.referrerId]
    );
    
    return { success: true, ownReferralCode: ownCode };
  } catch (error) {
    console.error('[Referral] Error creating user:', error);
    return { success: false };
  }
}

/**
 * Generate random referral code
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Referral enforcement middleware
 */
export function createReferralMiddleware(): Middleware<BotContext> {
  return async (ctx, next) => {
    // Skip for /start command (handled separately)
    if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/start')) {
      return next();
    }
    
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return next();
    }
    
    const needs = await needsReferralCode(telegramId);
    
    if (needs) {
      await ctx.reply(
        `🔒 **Access Required**

Please use \`/start YOUR_REFERRAL_CODE\` to activate your account.

Don't have a code? Ask a friend who uses this bot!`,
        { parse_mode: 'Markdown' }
      );
      return; // Block further processing
    }
    
    return next();
  };
}
