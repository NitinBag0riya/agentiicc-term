
import dotenv from 'dotenv';
import { connectPostgres, query, disconnectPostgres } from './src/db/postgres';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    console.log('Fetching most recent webhook logs to identify user...');
    
    const logs = await query(`
      SELECT 
        id, 
        payload->'message'->'from'->'id' as telegram_id,
        payload->'message'->'from'->'username' as username,
        payload->'message'->'text' as text,
        processed_at
      FROM webhook_logs
      ORDER BY processed_at DESC
      LIMIT 10;
    `);
    
    console.log('\nMost Recent Interactions:');
    console.table(logs);

  } catch (err) {
    console.error('❌ Error fetching logs:', err);
  } finally {
    await disconnectPostgres();
  }
}

main();
