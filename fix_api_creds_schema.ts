
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    console.log('Robust Schema Fix: api_credentials');

    // 1. Clean up ALL duplicates for user_id
    console.log('Step 1: Cleaning up any duplicate user_id entries...');
    await query(`
      DELETE FROM api_credentials 
      WHERE id NOT IN (
        SELECT MAX(id) 
        FROM api_credentials 
        GROUP BY user_id
      );
    `);
    console.log('✅ Duplicates cleaned up.');

    // 2. Drop any previous conflicting unique constraints if they exist
    // (In case there was a name mismatch or something)
    console.log('Step 2: Checking for existing unique constraints to replace...');
    // We'll just try to add OUR specific one.
    
    // 3. Add the unique constraint we need
    console.log('Step 3: Adding UNIQUE(user_id) constraint...');
    try {
      await query(`
        ALTER TABLE api_credentials 
        DROP CONSTRAINT IF EXISTS api_credentials_user_id_key;
      `);
      await query(`
        ALTER TABLE api_credentials 
        ADD CONSTRAINT api_credentials_user_id_key UNIQUE (user_id);
      `);
      console.log('✅ UNIQUE constraint added successfully.');
    } catch (err: any) {
      console.error('❌ Failed to add constraint:', err.message);
    }

  } catch (error) {
    console.error('❌ Error in main:', error);
  } finally {
    await disconnectPostgres();
  }
}

main();
