
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    console.log('Fetching all users...');
    
    const users = await query(`
      SELECT id, telegram_id, username, referral_code, is_verified, created_at
      FROM users
      ORDER BY created_at DESC;
    `);
    
    console.log('\nUsers:');
    console.table(users);

  } catch (err) {
    console.error('❌ Error fetching users:', err);
  } finally {
    await disconnectPostgres();
  }
}

main();
