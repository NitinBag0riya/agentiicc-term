
import { Pool } from 'pg';

// Global pool for re-use
let globalPool: Pool | null = null;

export function getPool() {
  if (!globalPool) {
    const dbUrl = process.env.DATABASE_URL;
    const config: any = {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false } // Enforce SSL for Supabase
    };

    // STRICT: Block Localhost
    if (dbUrl?.includes('localhost') || dbUrl?.includes('127.0.0.1')) {
      throw new Error("\n🛑 SECURITY ALERT: Local database connections are BLOCKED.\n   Please use the Supabase hosted endpoint as required by project policy.\n");
    }

    globalPool = new Pool(config);

    // Error handling for the pool
    globalPool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
      // Don't exit process immediately in dev, just log
    });
  }
  return globalPool;
}

export async function connectPostgres(maxRetries = 3): Promise<Pool> {
  const pool = getPool();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      const client = await pool.connect();
      console.log('✅ Connected to PostgreSQL successfully');
      client.release();
      return pool;
    } catch (error: any) {
      console.error(`❌ Connection attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
        console.log(`⏳ Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('❌ All connection attempts failed. Database is unreachable.');
        throw error;
      }
    }
  }

  throw new Error('Failed to connect after all retries');
}

export const dbRequest = async (text: string, params: any[] = []) => {
  // START_FIX: Use global pool instead of creating new one
  const pool = getPool();
  // END_FIX
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
    // Do NOT end the pool here
  }
}

export async function query(text: string, params: any[] = []) {
  const pool = getPool();
  return pool.query(text, params);
}

export async function initSchema() {
  console.log('🔄 Initializing Database Schema...');

  // Users Table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      username TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Migration: Add settings column if missing
  await query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb
  `);

  // API Credentials Table
  await query(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      exchange_id TEXT NOT NULL DEFAULT 'aster',
      api_key_encrypted TEXT NOT NULL,
      api_secret_encrypted TEXT NOT NULL,
      additional_data_encrypted TEXT,
      testnet BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, exchange_id)
    )
  `);

  console.log('✅ Database Schema Initialized');
}
