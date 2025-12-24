
import { Client } from 'pg';
import axios from 'axios';
import 'dotenv/config';

// --- CONFIG ---
const API_URL = 'http://localhost:3000';
const TEST_USER_ID = 703;

// --- HELPERS ---
async function log(step: string, msg: string) {
    console.log(`[${step}] ${msg}`);
}

async function main() {
    console.log('🚀 STARTING HYPERLIQUID JOURNEY TEST\n');
    
    // Connect to DB for verification
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // Authenticate
    let token = '';
    let headers: any = {};
    
    // ---------------------------------------------------------
    // STEP 0: AUTH
    // ---------------------------------------------------------
    await log('AUTH', 'Getting Session Token...');
    try {
        const authRes = await axios.post(`${API_URL}/auth/session`, { userId: TEST_USER_ID });
        token = authRes.data.token;
        headers = { Authorization: `Bearer ${token}` };
        await log('AUTH', '✅ Got Session Token');
    } catch (e: any) {
        console.error('Failed to auth:', e.message);
        process.exit(1);
    }

    // ---------------------------------------------------------
    // STEP 1: LINK HYPERLIQUID
    // ---------------------------------------------------------
    await log('STEP 1', 'Linking Hyperliquid...');
    
    // Check if already linked
    const existing = await db.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1 AND exchange_id = $2', [TEST_USER_ID, 'hyperliquid']);
    
    if (existing.rowCount === 0) {
        const hlKey = process.env.HYPERLIQUID_PRIVATE_KEY!;
        const hlAddress = process.env.HYPERLIQUID_ADDRESS!;
        
        // Encrypt
        const { encrypt } = require('./src/backend/utils/encryption');
        const encKey = encrypt(hlKey);
        const encSecret = encrypt(hlAddress); // storing address as secret (adapter logic varies, but usually PK is key)
        
        // Wait, check adapter logic. Adapter init:
        // const privateKey = await decrypt(creds.apiKeyEncrypted);
        // So apiKey = Private Key.
        
        await db.query(`
            INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted)
            VALUES ($1, 'hyperliquid', $2, $3)
        `, [TEST_USER_ID, encKey, encSecret]);
        
        await log('ACTION', 'Inserted Hyperliquid Credentials');
    } else {
        await log('ACTION', 'Hyperliquid ALREADY Linked. Skipping insert.');
    }

    // ---------------------------------------------------------
    // STEP 2: VERIFY DUAL CITADEL
    // ---------------------------------------------------------
    await log('STEP 2', 'Verifying Citadel State...');
    const linked2 = await db.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1', [TEST_USER_ID]);
    const exchanges = linked2.rows.map(r => r.exchange_id);
    
    if (exchanges.includes('aster') && exchanges.includes('hyperliquid')) {
        await log('VERIFY', '✅ DB confirms BOTH Aster & Hyperliquid linked.');
    } else {
        await log('VERIFY', `⚠️ State: ${JSON.stringify(exchanges)} (Expected Both)`);
    }

    // ---------------------------------------------------------
    // STEP 3: EXECUTE TRADE (Buy BTC on Hyperliquid)
    // ---------------------------------------------------------
    await log('STEP 3', 'Executing Trade on Hyperliquid (BTC-USD)...');
    
    // Need refresh token?
    try {
        const authRes = await axios.post(`${API_URL}/auth/session`, { userId: TEST_USER_ID });
        headers.Authorization = `Bearer ${authRes.data.token}`;
    } catch (e) {}

    try {
        // Hyperliquid uses "PURR" often for tests, or "BTC".
        // Let's use BTC. Minimum size? 
        // HL Min size is usually $10?
        // Balance check?
        const balRes = await axios.get(`${API_URL}/account?exchange=hyperliquid`, { headers });
        const bal = balRes.data.data.availableBalance;
        await log('PRE-CHECK', `Hyperliquid Balance: $${bal}`);

        if (bal < 5) {
             await log('WARNING', 'Balance might be too low for HL trade!');
        }

        const orderRes = await axios.post(`${API_URL}/order`, {
            exchange: 'hyperliquid',
            symbol: 'BTC', // Adapter should map BTC -> BTC-USD or PERP universe
            side: 'BUY',
            type: 'MARKET',
            quantity: 0.001, // 0.001 BTC ~ $96
            leverage: 20
        }, { headers });
        
        if (orderRes.data.success) {
            await log('TRADE', `✅ Order Placed: ${orderRes.data.data.orderId}`);
        } else {
            throw new Error('Order failed');
        }
    } catch (e: any) {
        await log('TRADE', `❌ Failed: ${e.response?.data?.message || e.message}`);
        console.log('Error data:', e.response?.data);
    }

    // ---------------------------------------------------------
    // STEP 4: VERIFY POSITION & CLOSE
    // ---------------------------------------------------------
    await log('STEP 4', 'Verifying Position & Closing...');
    await new Promise(r => setTimeout(r, 3000)); // Wait for fill
    
    try {
        const posRes = await axios.get(`${API_URL}/positions?exchange=hyperliquid`, { headers });
        const positions = posRes.data.data;
        const btcPos = positions.find((p: any) => p.symbol === 'BTC' || p.symbol === 'BTC-USD'); // Check normalization
        
        if (btcPos && parseFloat(btcPos.size) > 0) {
            await log('POSITION', `✅ BTC Position Found: ${btcPos.size}`);
            
            // Close it
            const closeRes = await axios.post(`${API_URL}/order`, {
                exchange: 'hyperliquid',
                symbol: 'BTC',
                side: 'SELL',
                type: 'MARKET',
                quantity: Math.abs(parseFloat(btcPos.size)),
                reduceOnly: true
            }, { headers });
             
             if (closeRes.data.success) {
                 await log('CLOSE', '✅ Position Closed.');
             }
        } else {
            await log('POSITION', `⚠️ No BTC position found. Positions: ${JSON.stringify(positions)}`);
        }
    } catch (e: any) {
        console.error(e);
        await log('POSITION', '❌ Error checking position');
    }

    await log('DONE', '🎉 Hyperliquid Test Complete.');
    await db.end();
}

main().catch(console.error);
