
import { Client } from 'pg';
import 'dotenv/config';

// Mock function to simulate the logic in overview-menu.composer.ts
function simulateShowOverviewLogic(linkedExchanges: string[]) {
    if (linkedExchanges.length === 0) {
        return "👋 WELCOME / LINK SCREEN";
    } else {
        return `🏰 CITADEL SCREEN (Showing data for: ${linkedExchanges.join(', ')})`;
    }
}

async function main() {
    console.log('🧪 Verifying Screen Logic Scenarios...\n');
    
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const TEST_ID = 999999; // Using a unique fake ID for this logic test

    try {
        // --- SCENARIO 1: NO LINKED EXCHANGES ---
        console.log('📍 SCENARIO 1: No Linked Exchanges');
        
        // Ensure clean slate
        await client.query('DELETE FROM api_credentials WHERE user_id = $1', [TEST_ID]);
        await client.query('DELETE FROM users WHERE id = $1', [TEST_ID]);
        
        // Create mock user
        const randomTgId = Math.floor(Math.random() * 1000000000);
        await client.query('INSERT INTO users (id, telegram_id, username) VALUES ($1, $2, \'mock_user\')', [TEST_ID, randomTgId]);
        
        // Fetch linked (Simulation)
        const res1 = await client.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1', [TEST_ID]);
        const linked1 = res1.rows.map(r => r.exchange_id);
        
        console.log(`   DB State: ${JSON.stringify(linked1)}`);
        console.log(`   👉 Bot would show: ${simulateShowOverviewLogic(linked1)}`);

        if (linked1.length === 0) console.log('   ✅ PASS: Correctly identifies unlinked state.');
        else console.log('   ❌ FAIL: DB not empty.');

        console.log('\n-------------------------------------------------\n');

        // --- SCENARIO 2: LINKED EXCHANGE (ASTER) ---
        console.log('📍 SCENARIO 2: One Linked Exchange (Aster)');
        
        // Link Aster
        await client.query(
            "INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted) VALUES ($1, 'aster', 'enc_key', 'enc_secret')", 
            [TEST_ID]
        );
        
        // Fetch linked
        const res2 = await client.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1', [TEST_ID]);
        const linked2 = res2.rows.map(r => r.exchange_id);
        
        console.log(`   DB State: ${JSON.stringify(linked2)}`);
        console.log(`   👉 Bot would show: ${simulateShowOverviewLogic(linked2)}`);

        if (linked2.includes('aster')) console.log('   ✅ PASS: Correctly identifies linked state.');
        else console.log('   ❌ FAIL: Exchange not linked.');

        // Clean up
        await client.query('DELETE FROM api_credentials WHERE user_id = $1', [TEST_ID]);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main();
