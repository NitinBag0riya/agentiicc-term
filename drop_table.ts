
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    console.log('Dropping api_credentials table...');
    await query('DROP TABLE IF EXISTS api_credentials');
    console.log('✅ Table dropped. It will be recreated on next startup.');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await disconnectPostgres();
  }
}

main();
