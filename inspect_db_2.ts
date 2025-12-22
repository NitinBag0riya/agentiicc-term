
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('telegram_id', 'referral_code');
    `);
    console.log('Columns found:', res);
  } catch (err) {
    console.error(err);
  } finally {
    await disconnectPostgres();
  }
}

main();
