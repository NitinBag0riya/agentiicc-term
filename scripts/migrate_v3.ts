
import { getPostgres, connectPostgres, disconnectPostgres } from '../src/db/postgres';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  console.log('🔄 Starting Migration v3: Adding additional_data_encrypted...');

  try {
    await connectPostgres();
    const db = getPostgres();

    // 1. Add column if not exists
    console.log('1. Adding additional_data_encrypted column...');
    await db.query(`
      ALTER TABLE api_credentials 
      ADD COLUMN IF NOT EXISTS additional_data_encrypted TEXT;
    `);

    console.log('✅ Migration v3 Complete!');
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  } finally {
    await disconnectPostgres();
  }
}

migrate();
