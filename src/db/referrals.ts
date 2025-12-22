/**
 * Referral System Functions
 *
 * Features:
 * - All users get a unique referral code
 * - New users MUST use a referral code to access the bot
 * - Track referral relationships
 * - View referral statistics
 */

import { Pool } from 'pg';
import crypto from 'crypto';

// ========== Types ==========

export interface ReferralStats {
  totalReferrals: number;
  verifiedReferrals: number;
  linkedReferrals: number; // Users who linked API keys
}

export interface ReferralUser {
  id: number;
  telegram_id: number;
  username: string | null;
  is_verified: boolean;
  created_at: Date;
}

// ========== Code Generation ==========

/**
 * Generate a unique referral code (8 characters, alphanumeric)
 */
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
  let code = '';
  const bytes = crypto.randomBytes(8);

  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return code;
}

/**
 * Generate a unique referral code that doesn't exist in database
 */
async function generateUniqueReferralCode(db: Pool): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateReferralCode();

    // Check if code already exists
    const result = await db.query(
      'SELECT id FROM users WHERE referral_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return code;
    }

    attempts++;
  }

  throw new Error('Failed to generate unique referral code after 10 attempts');
}

// ========== User Creation with Referral ==========

/**
 * Create a new user with a referral code requirement
 * Returns null if referral code is invalid
 */
export async function createUserWithReferral(
  db: Pool,
  telegramId: number,
  username: string | null,
  referralCode: string
): Promise<{ userId: number; ownReferralCode: string } | null> {
  // Validate referral code exists
  const referrerResult = await db.query<{ id: number; is_verified: boolean }>(
    'SELECT id, is_verified FROM users WHERE referral_code = $1',
    [referralCode.toUpperCase()]
  );

  if (referrerResult.rows.length === 0) {
    return null; // Invalid referral code
  }

  const referrerId = referrerResult.rows[0].id;

  // Generate unique referral code for new user
  const ownReferralCode = await generateUniqueReferralCode(db);

  // Create user
  const userResult = await db.query<{ id: number }>(
    `INSERT INTO users (
      telegram_id,
      username,
      referral_code,
      referred_by_user_id,
      referred_by_code,
      is_verified
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,
    [telegramId, username, ownReferralCode, referrerId, referralCode.toUpperCase(), true]
  );

  const userId = userResult.rows[0].id;

  // Create referral tracking record
  await db.query(
    `INSERT INTO referrals (
      referrer_user_id,
      referred_user_id,
      referral_code
    ) VALUES ($1, $2, $3)`,
    [referrerId, userId, referralCode.toUpperCase()]
  );

  return {
    userId,
    ownReferralCode,
  };
}

/**
 * Create initial seed user (for first user / admin)
 * This user can access without a referral code
 */
export async function createSeedUser(
  db: Pool,
  telegramId: number,
  username: string | null
): Promise<{ userId: number; referralCode: string }> {
  const referralCode = await generateUniqueReferralCode(db);

  const result = await db.query<{ id: number }>(
    `INSERT INTO users (
      telegram_id,
      username,
      referral_code,
      is_verified
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (telegram_id) DO UPDATE SET
      referral_code = COALESCE(users.referral_code, $3),
      is_verified = true
    RETURNING id`,
    [telegramId, username, referralCode, true]
  );

  return {
    userId: result.rows[0].id,
    referralCode,
  };
}

// ========== Referral Code Management ==========

/**
 * Get user's own referral code
 */
export async function getUserReferralCode(
  db: Pool,
  userId: number
): Promise<string | null> {
  const result = await db.query<{ referral_code: string | null }>(
    'SELECT referral_code FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // If user doesn't have a code yet, generate one
  if (!result.rows[0].referral_code) {
    const code = await generateUniqueReferralCode(db);
    await db.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2',
      [code, userId]
    );
    return code;
  }

  return result.rows[0].referral_code;
}

/**
 * Check if user is verified (has used a valid referral code)
 */
export async function isUserVerified(
  db: Pool,
  telegramId: number
): Promise<boolean> {
  const result = await db.query<{ is_verified: boolean }>(
    'SELECT is_verified FROM users WHERE telegram_id = $1',
    [telegramId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].is_verified === true;
}

/**
 * Validate if a referral code exists and is active
 */
export async function validateReferralCode(
  db: Pool,
  code: string
): Promise<{ valid: boolean; referrerUsername?: string }> {
  const result = await db.query<{ username: string | null }>(
    'SELECT username FROM users WHERE referral_code = $1 AND is_verified = true',
    [code.toUpperCase()]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  return {
    valid: true,
    referrerUsername: result.rows[0].username || 'Anonymous',
  };
}

// ========== Referral Statistics ==========

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(
  db: Pool,
  userId: number
): Promise<ReferralStats> {
  // Total referrals
  const totalResult = await db.query<{ count: string }>(
    'SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = $1',
    [userId]
  );

  // Verified referrals (users who completed signup)
  const verifiedResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM referrals r
     JOIN users u ON r.referred_user_id = u.id
     WHERE r.referrer_user_id = $1 AND u.is_verified = true`,
    [userId]
  );

  // Linked referrals (users who connected API keys)
  const linkedResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM referrals r
     JOIN users u ON r.referred_user_id = u.id
     JOIN api_credentials ac ON u.id = ac.user_id
     WHERE r.referrer_user_id = $1`,
    [userId]
  );

  return {
    totalReferrals: parseInt(totalResult.rows[0].count),
    verifiedReferrals: parseInt(verifiedResult.rows[0].count),
    linkedReferrals: parseInt(linkedResult.rows[0].count),
  };
}

/**
 * Get list of referred users
 */
export async function getReferredUsers(
  db: Pool,
  userId: number,
  limit: number = 20
): Promise<ReferralUser[]> {
  const result = await db.query<ReferralUser>(
    `SELECT u.id, u.telegram_id, u.username, u.is_verified, u.created_at
     FROM referrals r
     JOIN users u ON r.referred_user_id = u.id
     WHERE r.referrer_user_id = $1
     ORDER BY u.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get who referred a user
 */
export async function getReferrer(
  db: Pool,
  userId: number
): Promise<{ username: string | null; referralCode: string } | null> {
  const result = await db.query<{ username: string | null; referral_code: string }>(
    `SELECT u.username, u.referral_code
     FROM users current_user
     JOIN users u ON current_user.referred_by_user_id = u.id
     WHERE current_user.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    username: result.rows[0].username,
    referralCode: result.rows[0].referral_code,
  };
}

/**
 * Check if user needs referral code (not verified yet)
 */
export async function needsReferralCode(
  db: Pool,
  telegramId: number
): Promise<boolean> {
  const result = await db.query<{ is_verified: boolean }>(
    'SELECT is_verified FROM users WHERE telegram_id = $1',
    [telegramId]
  );

  // New user or unverified user needs referral code
  if (result.rows.length === 0) {
    return true;
  }

  return result.rows[0].is_verified !== true;
}
