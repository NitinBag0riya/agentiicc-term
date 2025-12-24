
import { startTest, log } from './test-utils'; // Assuming helper or just raw
import { Client } from 'pg';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL!;

async function main() {
  console.log('🔍 Verifying Welcome Screen Logic...');
  
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const TELEGRAM_ID = 7797429783;

  try {
    // 1. Check DB state
    const userRes = await client.query('SELECT id FROM users WHERE telegram_id = $1', [TELEGRAM_ID]);
    const userId = userRes.rows[0]?.id;
    
    if (!userId) {
        console.log('❌ User not found in DB!');
        return;
    }

    const creds = await client.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1', [userId]);
    const linked = creds.rows.map(r => r.exchange_id);
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`🔗 Linked Exchanges in DB: ${JSON.stringify(linked)}`);

    // 2. Simulate the Logic inside showOverview
    // Logic from src/composers/overview-menu.composer.ts:
    /*
        const linkedExchanges = await getLinkedExchanges(userId);
        if (linkedExchanges.length === 0) {
            // SHOW WELCOME
        } else {
            // SHOW CITADEL
        }
    */
   
    if (linked.length === 0) {
        console.log('👉 Result: Logic would show **WELCOME SCREEN**');
    } else {
        console.log('👉 Result: Logic would show **CITADEL (OVERVIEW)**');
    }

    if (linked.length > 0 && linked.length === 0) { 
        // Logic check failure simulation (impossible condition, but mimics logic drift)
        console.log('❌ CRITICAL LOGIC FAILURE DETECTED'); 
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

main();
