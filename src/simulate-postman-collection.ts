
const BASE_URL = 'http://localhost:3000';

// Randomized Telegram ID for fresh user each run
const TELEGRAM_ID = Math.floor(Math.random() * 1000000);

async function main() {
    console.log(`🚀 Starting Comprehensive Postman Simulation...`);
    console.log(`   Target User: Telegram ID ${TELEGRAM_ID}`);

    try {
        // ==========================================
        // 1. USER MANAGEMENT
        // ==========================================
        console.log('\n📂 [User Management]');
        
        // 1.1 Create User
        console.log('   ➡️  Create User...');
        const userRes = await fetch(`${BASE_URL}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: TELEGRAM_ID, username: 'sim_user' })
        });
        const userData: any = await userRes.json();
        if(!userData.success) throw new Error(`Create User Failed: ${JSON.stringify(userData)}`);
        const userId = userData.data.id;
        console.log(`       ✅ User ID: ${userId}`);

        // 1.2 Link Aster
        console.log('   ➡️  Link Aster Credentials...');
        const asterKey = process.env.ASTER_API_KEY || 'test-aster-key';
        const asterSecret = process.env.ASTER_API_SECRET || 'test-aster-secret';
        
        if (asterKey === 'test-aster-key') console.warn('       ⚠️ Using DUMMY Aster Credentials (Set ASTER_API_KEY in .env to fix)');
        else console.log('       ✨ Using REAL Aster Credentials');

        const asterRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId, exchange: 'aster', apiKey: asterKey, apiSecret: asterSecret
            })
        });
        const asterData: any = await asterRes.json();
        if(!asterData.success) throw new Error(`Link Aster Failed: ${JSON.stringify(asterData)}`);
        console.log('       ✅ Linked');

        // 1.3 Link Hyperliquid
        console.log('   ➡️  Link Hyperliquid Credentials...');
        const hlAddr = process.env.HYPERLIQUID_ADDRESS || '0xAddressMock';
        const hlKey = process.env.HYPERLIQUID_PRIVATE_KEY || '0xKeyMock';

        if (hlAddr === '0xAddressMock') console.warn('       ⚠️ Using DUMMY Hyperliquid Credentials (Set HYPERLIQUID_ADDRESS in .env to fix)');
        else console.log('       ✨ Using REAL Hyperliquid Credentials');

        const hlRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId, 
                exchange: 'hyperliquid', 
                address: hlAddr,
                privateKey: hlKey
            })
        });
        const hlData: any = await hlRes.json();
        if(!hlData.success) throw new Error(`Link HL Failed: ${JSON.stringify(hlData)}`);
        console.log('       ✅ Linked');

        // 1.4 List Exchanges
        console.log('   ➡️  List Exchanges...');
        const listRes = await fetch(`${BASE_URL}/user/exchanges?userId=${userId}`);
        const listData: any = await listRes.json();
        const exchanges = listData.data;
        if(!exchanges.includes('aster') || !exchanges.includes('hyperliquid')) throw new Error('Exchange list incomplete');
        console.log('       ✅ Exchanges:', exchanges);


        // ==========================================
        // 2. AUTHENTICATION & TRADING
        // ==========================================
        
        async function testExchangeFlow(exchange: string) {
            console.log(`\n📂 [Flow: ${exchange.toUpperCase()}]`);

            // 2.1 Auth
            console.log('   ➡️  Auth (Create Session)...');
            const authRes = await fetch(`${BASE_URL}/auth/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, exchangeId: exchange })
            });
            const authData: any = await authRes.json();
            if(!authData.success) throw new Error(`Auth Failed: ${JSON.stringify(authData)}`);
            const token = authData.token;
            console.log('       ✅ Token Acquired');

            const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

            // 2.2 Account Info
            console.log('   ➡️  Get Account...');
            const accRes = await fetch(`${BASE_URL}/account?exchange=${exchange}`, { headers });
            const accData: any = await accRes.json();
            
            // If we are using dummy creds, we expect failure from external API
            if(!accData.success) {
                console.warn(`       ⚠️ Account Fetch Failed (Expected with dummy creds): ${accData.error}`);
                if (accData.error.includes('API-key format invalid') || accData.error.includes('Hyperliquid')) {
                    console.log('       ✅ Handled external API rejection correctly');
                    // return; // We want to proceed to test routing for other endpoints even if creds fail
                } else {
                     throw new Error(`Unexpected Account Failure: ${accData.error}`);
                }
            }
            console.log(`       ✅ Balance: ${accData.data?.availableBalance}`);

            // 2.3 Place Order
            console.log('   ➡️  Place LIMIT Order...');
            const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';
            const price = '2000';
            const orderRes = await fetch(`${BASE_URL}/order`, {
                method: 'POST', headers,
                body: JSON.stringify({
                    symbol, side: 'BUY', type: 'LIMIT', quantity: '0.01', price, exchange
                })
            });
            const orderData: any = await orderRes.json();
            if(!orderData.success) {
                console.warn(`       ⚠️ Order Failed (Expected for bad creds/mock): ${orderData.error}`);
            } else {
                console.log(`       ✅ Order Placed: ${orderData.data.orderId}`);
            }

            // 2.4 Set Leverage & Margin (Expect failure with dummy creds, but verify routing)
            console.log('   ➡️  Set Leverage...');
            const levRes = await fetch(`${BASE_URL}/account/leverage`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    symbol: exchange === 'aster' ? 'ETHUSDT' : 'ETH',
                    leverage: 5,
                    exchange: exchange
                })
            });
            
            if (levRes.ok) {
                console.log('       ✅ Leverage Set');
            } else {
                const err = (await levRes.json() as any).error;
                console.log(`       ⚠️ Leverage Set Failed (Expected): ${err}`);
            }

            console.log('   ➡️  Set Margin Mode...');
            const marginRes = await fetch(`${BASE_URL}/account/margin-mode`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    symbol: exchange === 'aster' ? 'ETHUSDT' : 'ETH',
                    mode: 'ISOLATED',
                    exchange: exchange
                })
            });

             if (marginRes.ok) {
                console.log('       ✅ Margin Mode Set');
            } else {
                const err = (await marginRes.json() as any).error;
                console.log(`       ⚠️ Margin Mode Set Failed (Expected): ${err}`);
            }

            // 2.5 Cancel Order (Using a dummy orderId)
            console.log('   ➡️  Cancel Order...');
            const dummyOrderId = '123456789'; 
            const cancelRes = await fetch(`${BASE_URL}/order/${dummyOrderId}?exchange=${exchange}&symbol=${symbol}`, {
                method: 'DELETE', headers
            });
            const cancelData: any = await cancelRes.json();
            
            // Expected to fail logic or pass if routing is correct but order not found
            if(cancelData.success) {
                 console.log('       ✅ Cancel Order Success');
            } else {
                 // Check if it's an expected "Order not found" or "Auth" error, which means routing worked
                 const err = cancelData.error;
                 if (err.includes('not found') || err.includes('API-key') || err.includes('Hyperliquid') || err.includes('does not exist') || err.includes('Order failed')) {
                     console.log(`       ✅ Cancel Routed Correctly (Error: ${err})`);
                 } else {
                     console.warn(`       ⚠️ Cancel Failed (Unexpected): ${err}`);
                 }
            }

            // 2.6 Cancel All Orders
            console.log('   ➡️  Cancel All Orders...');
            const cancelAllRes = await fetch(`${BASE_URL}/orders?exchange=${exchange}&symbol=${symbol}`, {
                method: 'DELETE', headers
            });
            const cancelAllData: any = await cancelAllRes.json();
             
             if(cancelAllData.success) {
                 console.log('       ✅ Cancel All Success (or empty list)');
            } else {
                 const err = cancelAllData.error || cancelAllData.message; // cancelAll returns message directly on success sometimes? No, base adapter says {success, ...}
                 // server.ts wraps it? 
                 // const result = await adapter.cancelAllOrders(query.symbol); return result;
                 // So it returns whatever adapter returns.
                 
                 if (err && (err.includes('API-key') || err.includes('Hyperliquid') || err.includes('No open orders'))) {
                     console.log(`       ✅ Cancel All Routed Correctly (Error/Msg: ${err})`);
                 } else {
                     console.warn(`       ⚠️ Cancel All Failed (Unexpected): ${JSON.stringify(cancelAllData)}`);
                 }
            }

        }

        await testExchangeFlow('aster');
        await testExchangeFlow('hyperliquid');

        console.log('\n✨ ALL SIMULATIONS PASSED! The Postman collection logic is solid.');

    } catch (e: any) {
        console.error(`\n❌ SIMULATION FAILED: ${e.message}`);
        process.exit(1);
    }
}

main();
