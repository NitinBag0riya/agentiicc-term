
import { connectPostgres, query } from '../src/db/postgres';
import { encrypt } from '../src/utils/encryption';

async function seed() {
    try {
        console.log('🌱 Seeding Test User for Postman...');
        await connectPostgres();

        // 1. Create or Get Test User (Telegram ID 777777)
        const telegramId = 777777;
        const username = 'postman_test_user';
        
        let userRes = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
        
        if (userRes.rows.length === 0) {
            console.log('   Creating new user...');
            userRes = await query(
                'INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *',
                [telegramId, username]
            );
        } else {
             console.log('   User already exists.');
        }

        const user = userRes.rows[0];
        console.log(`   ✅ User ID: ${user.id}`);

        // 2. Encryption
        console.log('   Encrypting credentials...');
        const asterKey = process.env.ASTER_API_KEY || '';
        const asterSecret = process.env.ASTER_API_SECRET || '';
        const hlAddress = process.env.HYPERLIQUID_ADDRESS || '';
        const hlKey = process.env.HYPERLIQUID_PRIVATE_KEY || ''; // Assuming private key maps to secret here for simplicity adapter usage
        // Note: HyperliquidAdapter expects address as "user address" (often not stored in creds but derived or passed)
        // Check users.ts: storeApiCredentials(userId, exchangeId, key, secret, additional)
        // Hyperliquid adapter usually takes (address, privateKey). So key=address, secret=privateKey.

        const encAsterKey = encrypt(asterKey);
        const encAsterSecret = encrypt(asterSecret);
        
        // Hyperliquid: Factory expects Key=PrivateKey, Secret=Address
        const encHlKey = encrypt(hlKey);      // Private Key -> api_key
        const encHlSecret = encrypt(hlAddress); // Address -> api_secret

        // 3. Store Credentials
        // Aster
        await query(
            `INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted)
             VALUES ($1, 'aster', $2, $3)
             ON CONFLICT (user_id, exchange_id) DO UPDATE SET
             api_key_encrypted = $2, api_secret_encrypted = $3`,
            [user.id, encAsterKey, encAsterSecret]
        );
        console.log('   ✅ Aster Credentials Stored');

        // Hyperliquid
        await query(
            `INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted)
             VALUES ($1, 'hyperliquid', $2, $3)
             ON CONFLICT (user_id, exchange_id) DO UPDATE SET
             api_key_encrypted = $2, api_secret_encrypted = $3`,
            [user.id, encHlKey, encHlSecret]
        );
        console.log('   ✅ Hyperliquid Credentials Stored');

        console.log('\n🎉 SEED COMPLETE');
        console.log(`👉 USE USER ID: ${user.id} IN POSTMAN`);
        
        process.exit(0);
    } catch (e) {
        console.error('❌ Error Seeding:', e);
        process.exit(1);
    }
}

seed();
