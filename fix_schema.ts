
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    console.log('Adding referral_code column...');
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;`);
      console.log('Added referral_code');
    } catch (e) {
        console.log('Error adding referral_code (maybe exists?):', e.message);
    }
    
    // Also check for other new columns if any?
    // referred_by_user_id, referred_by_code
    try {
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
        console.log('Added referred_by_user_id');
    } catch (e) {
         console.log('Error adding referred_by_user_id:', e.message);
    }

    try {
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_code TEXT;`);
        console.log('Added referred_by_code');
    } catch (e) {
         console.log('Error adding referred_by_code:', e.message);
    }

    try {
        await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`);
        console.log('Added is_verified');
    } catch (e) {
         console.log('Error adding is_verified:', e.message);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await disconnectPostgres();
  }
}

main();
