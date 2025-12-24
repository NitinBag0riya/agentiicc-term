
import { Client } from 'pg';
import axios from 'axios';
import 'dotenv/config';

// --- CONFIG ---
const API_URL = 'http://localhost:3000';
const REFERRER_ID = 703;      // Existing verified user
const NEW_USER_ID = 88888;    // New mock user
const NEW_USER_NAME = 'ui_test_user';

async function log(step: string, msg: string) {
    console.log(`[${step}] ${msg}`);
}

async function main() {
    console.log('🚀 STARTING MASTER UI FLOW TEST (v2)\n');
    
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------
    await log('SETUP', 'Cleaning up previous test user...');
    // Delete by internal ID first
    const uRes = await db.query('SELECT id FROM users WHERE telegram_id = $1', [NEW_USER_ID.toString()]);
    if (uRes.rows.length > 0) {
        const uid = uRes.rows[0].id;
        // Delete referrals (as referred)
        await db.query('DELETE FROM referrals WHERE referred_user_id = $1', [uid]);
        // Delete credentials (by internal ID per schema inspection)
        await db.query('DELETE FROM api_credentials WHERE user_id = $1', [uid]);
    }
    // Delete user
    await db.query('DELETE FROM users WHERE telegram_id = $1', [NEW_USER_ID.toString()]);
    
    // ---------------------------------------------------------
    // STEP 0: REFERRER
    // ---------------------------------------------------------
    await log('STEP 0', 'Getting Referrer Code (User 703)...');
    let res = await db.query('SELECT referral_code FROM users WHERE telegram_id = $1', [REFERRER_ID.toString()]);
    if (res.rows.length === 0) {
        await db.query('INSERT INTO users (telegram_id, username, is_verified) VALUES ($1, $2, true)', [REFERRER_ID.toString(), 'referrer_user']);
        res = await db.query('SELECT referral_code FROM users WHERE telegram_id = $1', [REFERRER_ID.toString()]);
    }
    let refCode = res.rows[0]?.referral_code;
    if (!refCode) {
        refCode = 'REF703';
        await db.query('UPDATE users SET referral_code = $1 WHERE telegram_id = $2', [refCode, REFERRER_ID.toString()]);
    }
    await log('STEP 0', `Found Referrer Code: ${refCode}`);

    // ---------------------------------------------------------
    // STEP 1: VISITOR ENTRY
    // ---------------------------------------------------------
    await log('STEP 1', `Simulating /start ${refCode} for User ${NEW_USER_ID}...`);
    
    const ownCode = 'TEST888';
    
    // Create new user (using telegram_id)
    const insertRes = await db.query(`
        INSERT INTO users (telegram_id, username, referral_code, referred_by_user_id, is_verified)
        VALUES ($1, $2, $3, (SELECT id FROM users WHERE telegram_id = $4), true)
        RETURNING id
    `, [NEW_USER_ID.toString(), NEW_USER_NAME, ownCode, REFERRER_ID.toString()]);
    
    const internalId = insertRes.rows[0].id;
    
    // Insert Referral Record
    const referrerRes = await db.query('SELECT id FROM users WHERE telegram_id = $1', [REFERRER_ID.toString()]);
    const referrerInternalId = referrerRes.rows[0].id;
    
    await db.query(`
        INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code)
        VALUES ($1, $2, $3)
    `, [referrerInternalId, internalId, refCode]);

    await log('STEP 1', `✅ User Created (Internal ID: ${internalId}) via Referral.`);

    // ---------------------------------------------------------
    // STEP 2: ONBOARDING (Link First!)
    // ---------------------------------------------------------
    await log('STEP 2', 'Simulating Link Aster...');
    
    const { encrypt } = require('./src/backend/utils/encryption');
    const apiKey = process.env.ASTER_API_KEY!;
    const apiSecret = process.env.ASTER_API_SECRET!;
    
    // Insert Creds using INTERNAL ID
    await db.query(`
        INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted)
        VALUES ($1, 'aster', $2, $3)
    `, [internalId, encrypt(apiKey), encrypt(apiSecret)]); 
    
    await log('STEP 2', '✅ Aster Linked Credentials.');

    // ---------------------------------------------------------
    // STEP 2.5: AUTH (Now that we are linked)
    // ---------------------------------------------------------
    // Auth using INTERNAL ID
    const authRes = await axios.post(`${API_URL}/auth/session`, { userId: internalId });
    const token = authRes.data.token;
    
    if (!token) {
        console.log('Auth Failed Response:', authRes.data);
        throw new Error('Failed to get token');
    }
    
    await log('AUTH', `✅ Got Token (Length: ${token.length})`);
    const headers = { Authorization: `Bearer ${token}` };

    // ---------------------------------------------------------
    // CHECK CITADEL
    // ---------------------------------------------------------
    try {
        const balRes = await axios.get(`${API_URL}/account?exchange=aster`, { headers });
        if (balRes.data.success) {
            await log('VERIFY', `✅ Citadel Loaded: Balance $${balRes.data.data.availableBalance}`);
        } else {
             throw new Error('Citadel load failed');
        }
    } catch (e: any) {
        await log('VERIFY', `❌ Citadel Check Failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // STEP 3: DISCOVERY
    // ---------------------------------------------------------
    await log('STEP 3', 'Simulating Search "BTC"...');
    try {
        const searchRes = await axios.get(`${API_URL}/assets/search?q=BTC`, { headers });
        const results = searchRes.data.data;
        const asterBTC = results.find((r: any) => r.symbol === 'BTCUSDT' && r.exchange === 'aster');
        
        if (asterBTC) {
            await log('VERIFY', '✅ Search found BTCUSDT on Aster.');
        } else {
            await log('VERIFY', '❌ Search failed to find BTCUSDT.');
        }
    } catch(e) { console.error(e); }

    // ---------------------------------------------------------
    // STEP 4: TRADING
    // ---------------------------------------------------------
    await log('STEP 4', 'Simulating Trade (Buy Limit)...');
    
    let orderId;
    try {
        const orderRes = await axios.post(`${API_URL}/order`, {
            exchange: 'aster', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', price: 20000, quantity: 0.001
        }, { headers });
        
        if (orderRes.data.success) {
            orderId = orderRes.data.data.orderId;
            await log('TRADE', `✅ Limit Order Placed: ${orderId}`);
        } else {
            throw new Error(orderRes.data.error || 'Trade failed');
        }
    } catch (e: any) {
        await log('TRADE', `❌ Trade Failed: ${e.message}`);
        if(e.response) console.log(e.response.data);
    }

    // ---------------------------------------------------------
    // STEP 5: MANAGEMENT
    // ---------------------------------------------------------
    if (orderId) {
        await log('STEP 5', 'Simulating "Manage Orders" -> Cancel All...');
        
        const cancelRes = await axios.delete(`${API_URL}/orders`, { 
            headers,
            params: { exchange: 'aster', symbol: 'BTCUSDT' }
        });
        
        if (cancelRes.data.success) {
             await log('CANCEL', '✅ Cancel All Executed.');
        } else {
             await log('CANCEL', '❌ Cancel All Failed.');
        }
    }

    // ---------------------------------------------------------
    // STEP 6: REFERRALS
    // ---------------------------------------------------------
    await log('STEP 6', 'Verifying Referrals...');
    const refCheck = await db.query('SELECT count(*) FROM referrals WHERE referrer_user_id = $1', [referrerInternalId]);
    await log('VERIFY', `Referrer 703 now has ${refCheck.rows[0].count} referrals.`);
    
    await log('DONE', '🎉 Master UI Flow Test Complete.');
    await db.end();
}

main().catch(console.error);
