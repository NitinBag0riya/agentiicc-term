/**
 * Helper functions for AsterDex client integration
 */

import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { createAsterClient, type AsterClient, AsterDexError } from './client';
import { decrypt } from '../utils/encryption';

const ASTER_BASE_URL = process.env.ASTER_BASE_URL || 'https://fapi.asterdex.com';

/**
 * Get AsterDex client for a user
 */
export async function getAsterClientForUser(
  userId: number,
  db: Pool,
  redis: Redis
): Promise<AsterClient> {
  // Get encrypted credentials from database
  const result = await db.query(
    'SELECT api_key_encrypted, api_secret_encrypted FROM api_credentials WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('No API credentials found. Please link your API first with /link');
  }

  const { api_key_encrypted, api_secret_encrypted } = result.rows[0];

  // Decrypt credentials
  const apiKey = decrypt(api_key_encrypted);
  const apiSecret = decrypt(api_secret_encrypted);

  // Create and return client
  return createAsterClient({
    baseUrl: ASTER_BASE_URL,
    apiKey,
    apiSecret,
    redis,
  });
}

/**
 * Test if API credentials are valid
 */
export async function testApiCredentials(
  apiKey: string,
  apiSecret: string,
  redis: Redis
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = await createAsterClient({
      baseUrl: ASTER_BASE_URL,
      apiKey,
      apiSecret,
      redis,
    });

    const isValid = await client.validateCredentials();

    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid API credentials. Please check your API key and secret.',
      };
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof AsterDexError) {
      if (error.code === 'IP_BANNED') {
        return {
          valid: false,
          error: 'IP is banned by AsterDex. Please contact support.',
        };
      }

      if (error.code === 'RATE_LIMITED') {
        return {
          valid: false,
          error: 'Rate limited. Please try again in a few moments.',
        };
      }

      return {
        valid: false,
        error: `API error: ${error.message}`,
      };
    }

    return {
      valid: false,
      error: 'Failed to validate credentials. Please try again.',
    };
  }
}
