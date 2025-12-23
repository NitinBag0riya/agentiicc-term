/**
 * User database operations
 * Functional style
 */
import { query } from './postgres';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiCredentials {
  id: number;
  user_id: number;
  api_key_encrypted: string;
  api_secret_encrypted: string;
  testnet: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(
  telegramId: number
): Promise<User | null> {
  const rows = await query<User>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );
  return rows[0] || null;
}

/**
 * Create new user
 */
export async function createUser(
  telegramId: number,
  username?: string
): Promise<User> {
  const rows = await query<User>(
    `INSERT INTO users (telegram_id, username)
     VALUES ($1, $2)
     RETURNING *`,
    [telegramId, username]
  );
  return rows[0];
}

/**
 * Get or create user
 */
export async function getOrCreateUser(
  telegramId: number,
  username?: string
): Promise<User> {
  let user = await getUserByTelegramId(telegramId);
  if (!user) {
    user = await createUser(telegramId, username);
    console.log(`[DB] Created new user: ${user.id} (telegram: ${telegramId})`);
  }
  return user;
}

/**
 * Store API credentials (encrypted)
 */
/**
 * Store API credentials (encrypted)
 */
export async function storeApiCredentials(
  userId: number,
  apiKeyEncrypted: string,
  apiSecretEncrypted: string,
  testnet = false,
  exchangeId = 'aster'
): Promise<ApiCredentials> {
  const rows = await query<ApiCredentials>(
    `INSERT INTO api_credentials (user_id, api_key_encrypted, api_secret_encrypted, testnet, exchange_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, exchange_id)
     DO UPDATE SET
       api_key_encrypted = $2,
       api_secret_encrypted = $3,
       testnet = $4,
       updated_at = NOW()
     RETURNING *`,
    [userId, apiKeyEncrypted, apiSecretEncrypted, testnet, exchangeId]
  );
  return rows[0];
}

/**
 * Get API credentials for user
 */
export async function getApiCredentials(
  userId: number,
  exchangeId = 'aster'
): Promise<ApiCredentials | null> {
  const rows = await query<ApiCredentials>(
    'SELECT * FROM api_credentials WHERE user_id = $1 AND exchange_id = $2',
    [userId, exchangeId]
  );
  return rows[0] || null;
}

/**
 * Delete API credentials
 */
export async function deleteApiCredentials(userId: number, exchangeId = 'aster'): Promise<void> {
  await query('DELETE FROM api_credentials WHERE user_id = $1 AND exchange_id = $2', [userId, exchangeId]);
}

/**
 * Get all linked exchanges for a user
 */
export async function getLinkedExchanges(userId: number): Promise<string[]> {
  const rows = await query<{ exchange_id: string }>(
    'SELECT exchange_id FROM api_credentials WHERE user_id = $1',
    [userId]
  );
  return rows.map(row => row.exchange_id);
}

