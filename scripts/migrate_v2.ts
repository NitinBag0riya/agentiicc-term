
import 'dotenv/config';
import { connectPostgres, getPool, disconnectPostgres } from '../src/db/postgres';

async function migrate() {
  console.log('🔄 Starting Database Migration (v2)...');
  
  try {
    await connectPostgres();
    const pool = getPool();

    // 1. Add exchange_id column if it doesn't exist
    console.log('1️⃣  Adding exchange_id column...');
    await pool.query(`
      ALTER TABLE api_credentials 
      ADD COLUMN IF NOT EXISTS exchange_id TEXT NOT NULL DEFAULT 'aster';
    `);

    // 2. Drop old unique constraint (user_id)
    // We need to find the constraint name first, usually api_credentials_user_id_key
    console.log('2️⃣  Dropping old unique constraint...');
    try {
      await pool.query(`
        ALTER TABLE api_credentials 
        DROP CONSTRAINT IF EXISTS api_credentials_user_id_key;
      `);
    } catch (e) {
      console.log('   (Constraint might strictly be named differently, trying generic drop if needed, but proceeding)');
    }

    // 3. Add new unique constraint (user_id, exchange_id)
    console.log('3️⃣  Adding new composite unique constraint...');
    await pool.query(`
      ALTER TABLE api_credentials 
      ADD CONSTRAINT api_credentials_user_id_exchange_id_key 
      UNIQUE (user_id, exchange_id);
    `);

    console.log('✅ Migration Check:');
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'api_credentials';
    `);
    console.table(res.rows.map(r => ({ col: r.column_name, type: r.data_type })));

  } catch (err: any) {
    console.error('❌ Migration Failed:', err.message);
  } finally {
    await disconnectPostgres();
  }
}

migrate();
