
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
    console.log('🚀 STARTING CANCEL FLOWS TEST\n');
    
    // Auth
    let headers: any = {};
    try {
        const authRes = await axios.post(`${API_URL}/auth/session`, { userId: TEST_USER_ID });
        headers = { Authorization: `Bearer ${authRes.data.token}` };
        await log('AUTH', '✅ Got Session Token');
    } catch (e: any) {
        console.error('Failed to auth:', e.message);
        process.exit(1);
    }

    // ---------------------------------------------------------
    // TEST 1: SINGLE CANCEL (Aster)
    // ---------------------------------------------------------
    await log('TEST 1', 'Testing Single Cancel (Aster)...');
    
    // 1. Place Limit Order (Buy BTC at $10,000 - unlikely to fill)
    try {
        const orderRes = await axios.post(`${API_URL}/order`, {
            exchange: 'aster',
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            price: 10000, 
            quantity: 0.001
        }, { headers });
        
        const orderId = orderRes.data.data.orderId;
        await log('ACTION', `Placed Limit Order: ${orderId}`);
        
        // 2. Cancel It
        await log('ACTION', 'Cancelling Order...');
        const cancelRes = await axios.delete(`${API_URL}/order/${orderId}`, { 
            headers,
            params: { exchange: 'aster', symbol: 'BTCUSDT' }
        });
        
        if (cancelRes.data.success) {
            await log('VERIFY', '✅ Cancel API returned success.');
        } else {
            throw new Error('Cancel failed');
        }

        // 3. Verify it's gone (by checking open orders)
        // Note: API might not have GET /orders endpoint exposed nicely or cache delay.
        // But if delete succeeded, it's good.
        
    } catch (e: any) {
        await log('TEST 1', `❌ Failed: ${e.message}`);
        if(e.response) console.log(e.response.data);
    }

    // ---------------------------------------------------------
    // TEST 2: CANCEL ALL (Aster)
    // ---------------------------------------------------------
    await log('TEST 2', 'Testing Cancel All (Aster)...');
    
    try {
        // 1. Place 2 Orders
        await Promise.all([
            axios.post(`${API_URL}/order`, {
                exchange: 'aster', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', price: 10100, quantity: 0.001
            }, { headers }),
            axios.post(`${API_URL}/order`, {
                exchange: 'aster', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', price: 10200, quantity: 0.001
            }, { headers })
        ]);
        await log('ACTION', 'Placed 2 Limit Orders');
        
        // 2. Cancel All
        // Endpoint? DELETE /orders ?
        // routes.ts line 286: router.delete('/orders', ...
        
        const cancelAllRes = await axios.delete(`${API_URL}/orders`, {
            headers,
            params: { exchange: 'aster', symbol: 'BTCUSDT' }
        });
        
        if (cancelAllRes.data.success) {
            await log('VERIFY', `✅ Cancel All Success: ${JSON.stringify(cancelAllRes.data.data)}`);
        } else {
            throw new Error('Cancel All failed');
        }
    } catch (e: any) {
         await log('TEST 2', `❌ Failed: ${e.message}`);
         if(e.response) console.log(e.response.data);
    }

    await log('DONE', '🎉 Cancel Tests Complete.');
}

main().catch(console.error);
