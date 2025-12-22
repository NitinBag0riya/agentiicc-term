import { query } from './postgres';

export interface User {
  id: number;
  telegram_id: number;
  username?: string;
  referral_code?: string;
}

export interface ApiCredentials {
  id: number;
  user_id: number;
  exchange_id: string;
  api_key_encrypted: string;
  api_secret_encrypted: string;
  additional_data_encrypted?: string;
}

export async function getOrCreateUser(telegramId: number, username?: string): Promise<User> {
  const res = await query(
    `INSERT INTO users (telegram_id, username)
     VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET username = $2
     RETURNING *`,
    [telegramId, username]
  );
  return res.rows[0];
}

export async function storeApiCredentials(
  userId: number,
  exchangeId: string,
  encryptedKey: string,
  encryptedSecret: string,
  additionalData?: string
) {
  return query(
    `INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted, additional_data_encrypted)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, exchange_id) DO UPDATE SET
       api_key_encrypted = $3,
       api_secret_encrypted = $4,
       additional_data_encrypted = $5,
       updated_at = NOW()
     RETURNING *`,
    [userId, exchangeId, encryptedKey, encryptedSecret, additionalData]
  );
}

export async function getApiCredentials(userId: number, exchangeId: string): Promise<ApiCredentials | null> {
  const res = await query(
    'SELECT * FROM api_credentials WHERE user_id = $1 AND exchange_id = $2',
    [userId, exchangeId]
  );
  return res.rows[0] || null;
}

export async function deleteApiCredentials(userId: number, exchangeId: string) {
  return query(
    'DELETE FROM api_credentials WHERE user_id = $1 AND exchange_id = $2',
    [userId, exchangeId]
  );
}

export async function getLinkedExchanges(userId: number): Promise<string[]> {
  const res = await query(
    'SELECT exchange_id FROM api_credentials WHERE user_id = $1',
    [userId]
  );
  return res.rows.map(row => row.exchange_id);
}
