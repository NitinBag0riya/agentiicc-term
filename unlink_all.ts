
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // Hardcoded known IDs for safety
  const TELEGRAM_ID = 7797429783;
  const USER_ID = 703;

  console.log(`🗑️ Unlinking all exchanges for User ${USER_ID} / TG ${TELEGRAM_ID}...`);

  const res = await client.query(`
    DELETE FROM api_credentials 
    WHERE user_id = $1 
       OR user_id = (SELECT id FROM users WHERE telegram_id = $2)
  `, [USER_ID, TELEGRAM_ID]);

  console.log(`✅ Deleted ${res.rowCount} credentials.`);
  await client.end();
}

main().catch(console.error);
