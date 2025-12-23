/**
 * PostgreSQL connection for persistent data
 * Functional style - no classes
 */
import { Pool, PoolClient, PoolConfig } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let pool: Pool | null = null;

/**
 * Connect to PostgreSQL
 */
export async function connectPostgres(url?: string): Promise<Pool> {
  if (pool) {
    return pool;
  }

  console.log('[Postgres] Connecting...');

  // Load CA certificate for DigitalOcean managed database
  let sslConfig: any = false;

  try {
    const caCertPath = join(process.cwd(), 'ca-certificate.crt');
    const ca = readFileSync(caCertPath, 'utf8');
    sslConfig = { ca, rejectUnauthorized: true };
    console.log('[Postgres] Using CA certificate for SSL');
  } catch (err) {
    // Fall back to non-SSL if CA cert not found (local dev)
    console.log('[Postgres] CA certificate not found, using basic SSL');
    sslConfig = { rejectUnauthorized: false };
  }

  // Support both connection string and individual params
  const databaseUrl = url || process.env.DATABASE_URL;

  const config: PoolConfig = {
    connectionString: databaseUrl,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE,
    ssl: sslConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  if (process.env.SSL_DISABLED === 'true') {
    config.ssl = false;
  }
  pool = new Pool(config);

  // Test connection
  const client = await pool.connect();
  const result = await client.query('SELECT NOW()');
  client.release();

  console.log('[Postgres] ✅ Connected successfully');
  console.log('[Postgres] Server time:', result.rows[0].now);

  // Error handling
  pool.on('error', err => {
    console.error('[Postgres] ❌ Unexpected error:', err);
  });

  return pool;
}

/**
 * Get PostgreSQL pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Postgres not connected. Call connectPostgres() first.');
  }
  return pool;
}

/**
 * Alias for getPool (for consistency)
 */
export const getPostgres = getPool;

/**
 * Execute a query
 */
export async function query<
  T extends Record<string, unknown> = Record<string, unknown>
>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get a client from the pool (for transactions)
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Disconnect from PostgreSQL
 */
export async function disconnectPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[Postgres] Disconnected');
  }
}

/**
 * Check if PostgreSQL is connected
 */
export function isPostgresConnected(): boolean {
  return pool !== null;
}

/**
 * Initialize database schema
 */
export async function initSchema(): Promise<void> {
  console.log('[Postgres] Initializing schema...');

  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      referral_code TEXT UNIQUE,
      referred_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      referred_by_code TEXT,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // API credentials table (encrypted)
  await query(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      exchange_id TEXT NOT NULL DEFAULT 'aster',
      api_key_encrypted TEXT NOT NULL,
      api_secret_encrypted TEXT NOT NULL,
      testnet BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, exchange_id)
    )
  `);

  // MIGRATION: Ensure exchange_id exists and constraints are correct
  try {
      await query(`ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS exchange_id TEXT NOT NULL DEFAULT 'aster'`);
      
      // Drop old single-user constraint if it exists
      await query(`
        DO $$ 
        BEGIN 
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_credentials_user_id_key') THEN 
                ALTER TABLE api_credentials DROP CONSTRAINT api_credentials_user_id_key; 
            END IF; 
        END $$;
      `);

      // Ensure new composite constraint exists (Postgres handles duplicates inside CREATE TABLE, but for existing tables we typically add it if missing. 
      // The CREATE TABLE above handles fresh installs. This block handles migrations.)
      // Note: We won't try to add the constraint validation here to avoid complexity if it already exists, 
      // as CREATE TABLE IF NOT EXISTS defines it. But if table existed, we need to add it.
      await query(`
         DO $$ 
         BEGIN 
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_credentials_user_id_exchange_id_key') THEN 
                 ALTER TABLE api_credentials ADD CONSTRAINT api_credentials_user_id_exchange_id_key UNIQUE(user_id, exchange_id); 
             END IF; 
         END $$;
      `);

  } catch (err) {
      console.warn('[Postgres] Schema migration warning:', err);
  }


  // Orders table (trade history + audit trail)
  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      telegram_id BIGINT NOT NULL,

      -- Operation metadata
      operation_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operation_data JSONB NOT NULL,

      -- Basic order info
      symbol TEXT NOT NULL,
      side TEXT,
      type TEXT,
      quantity TEXT,
      price TEXT,

      -- Confirmation tracking
      user_confirm BOOLEAN DEFAULT FALSE,
      user_confirm_at TIMESTAMP,

      -- Exchange execution result
      exchange_order_id TEXT,
      exchange_status TEXT,
      exchange_response JSONB,
      executed_at TIMESTAMP,

      -- Execution result
      success BOOLEAN,
      error_message TEXT,
      error_code TEXT,

      -- Timestamps
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Webhook logs table (debugging/audit)
  await query(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      update_id BIGINT,
      payload JSONB NOT NULL,
      processed_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Referral tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      referral_code TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(referred_user_id)
    )
  `);

  // Create indexes
  await query(
    `CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_telegram_id ON orders(telegram_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_operation_id ON orders(operation_id)`
  );
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol)`);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_user_confirm ON orders(user_confirm)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_orders_exchange_order_id ON orders(exchange_order_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_webhook_logs_update_id ON webhook_logs(update_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed_at ON webhook_logs(processed_at)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload ON webhook_logs USING GIN (payload)`
  );

  console.log('[Postgres] ✅ Schema initialized');
}
