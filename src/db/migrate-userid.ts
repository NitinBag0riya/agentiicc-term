/**
 * Database Migration - Fix user_id integer overflow
 * Changes user_id from INTEGER to TEXT to support large Telegram IDs
 */
import { getPool } from './postgres';

async function migrate() {
  console.log('🔧 Starting database migration...');
  console.log('   Fixing user_id integer overflow issue\n');
  
  const pool = getPool();
  
  try {
    // Check current schema
    console.log('1️⃣ Checking current schema...');
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_credentials' 
      AND column_name = 'user_id'
    `);
    
    if (schemaCheck.rows.length > 0) {
      console.log(`   Current type: ${schemaCheck.rows[0].data_type}`);
    }
    
    // Drop the foreign key constraint first
    console.log('\n2️⃣ Dropping foreign key constraint...');
    await pool.query(`
      ALTER TABLE api_credentials 
      DROP CONSTRAINT IF EXISTS api_credentials_user_id_fkey
    `);
    console.log('   ✅ Foreign key dropped');
    
    // Alter the column type in api_credentials
    console.log('\n3️⃣ Altering api_credentials.user_id to TEXT...');
    await pool.query(`
      ALTER TABLE api_credentials 
      ALTER COLUMN user_id TYPE TEXT
    `);
    console.log('   ✅ api_credentials.user_id altered');
    
    // Note: We're NOT altering users.id because it's used by Supabase auth
    // Instead, we'll just not use the foreign key constraint
    
    // Verify the change
    console.log('\n4️⃣ Verifying the change...');
    const verifyCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_credentials' 
      AND column_name = 'user_id'
    `);
    
    if (verifyCheck.rows.length > 0) {
      console.log(`   New type: ${verifyCheck.rows[0].data_type}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('   Large Telegram user IDs (like 7797429783) can now be stored.\n');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
