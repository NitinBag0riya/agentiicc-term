
import { UniversalApiClient } from './src/services/universalApi';
import { getOrCreateUser, storeApiCredentials, getApiCredentials } from './src/db/users';
import { connectPostgres } from './src/db/postgres';
import { encrypt, initEncryption } from './src/utils/encryption';
import type { AsterWriteOp } from './src/services/ops/types';

// Mock Config
const TEST_TELEGRAM_ID = 88888;
const EXCHANGE_ASTER = 'aster';
const EXCHANGE_HL = 'hyperliquid';

async function runTests() {
    console.log('🚀 Starting Full Flow Test (Aster & Hyperliquid)...');
    try {
        if (!process.env.ENCRYPTION_KEY) throw new Error("Missing ENCRYPTION_KEY");
        initEncryption(process.env.ENCRYPTION_KEY);
        await connectPostgres();
        
        // --- Setup User ---
        console.log('\n--- Setup User ---');
        const user = await getOrCreateUser(TEST_TELEGRAM_ID, 'LocalTestUser');
        console.log(`✅ User Ready: ID ${user.id}`);
        
        // --- Setup Creds (Aster) ---
        if (process.env.ASTER_API_KEY) {
            const encKey = encrypt(process.env.ASTER_API_KEY);
            const encSecret = encrypt(process.env.ASTER_API_SECRET!);
            await storeApiCredentials(user.id, encKey, encSecret, false, EXCHANGE_ASTER);
            console.log('✅ Aster Creds Stored.');
        }

        // --- Setup Creds (Hyperliquid) ---
        // Factory Logic: new HL(apiSecret, apiKey) -> (Address, PrivateKey)
        // Store: key=Private, secret=Address
        if (process.env.HYPERLIQUID_PRIVATE_KEY && process.env.HYPERLIQUID_ADDRESS) {
            const encKey = encrypt(process.env.HYPERLIQUID_PRIVATE_KEY); // Private Key -> api_key column
            const encSecret = encrypt(process.env.HYPERLIQUID_ADDRESS);    // Address -> api_secret column
            await storeApiCredentials(user.id, encKey, encSecret, false, EXCHANGE_HL);
            console.log('✅ Hyperliquid Creds Stored.');
        } else {
             console.warn("⚠️ Missing HYPERLIQUID keys in .env, skipping HL setup.");
        }

        // --- Test Aster ---
        await testExchangeFlow(user.id, EXCHANGE_ASTER, 'BTCUSDT');

        // --- Test Hyperliquid ---
        await testExchangeFlow(user.id, EXCHANGE_HL, 'ETH'); 

        console.log('\n🏁 All Tests Completed Successfully.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Test Failed:', e);
        process.exit(1);
    }
}

async function testExchangeFlow(userId: number, exchange: string, symbol: string) {
    console.log(`\n🔵 Testing Exchange: ${exchange.toUpperCase()} (${symbol})`);
    const client = new UniversalApiClient();
    
    // 1. Init Session
    console.log(`[${exchange}] Init Session...`);
    await client.initSession(userId, exchange);
    
    // 2. Overview / Balances
    console.log(`[${exchange}] Get Account Info...`);
    const balanceRes = await client.getAccount();
    if (balanceRes.success) {
        const bal = balanceRes.data.parameters?.totalBalance || balanceRes.data.totalWalletBalance || 'Unknown';
        console.log(`   ✅ Balance: ${bal}`);
    } else {
        console.error(`   ❌ Failed Get Account: ${balanceRes.error}`);
    }

    // 3. Create Order (Limit, far from price)
    console.log(`[${exchange}] Create Limit Order (Test)...`);
    // Need current price to place far away?
    const tickerRes = await client.getTicker(symbol);
    let price = 1000;
    if (tickerRes.success) {
        // Aster returns 'price', HL might return 'midPx' or others. UniversalApi might standardize?
        // Current impl returns raw adapter response?
        console.log(`[${exchange}] Ticker Data:`, JSON.stringify(tickerRes.data));
        
        const mark = parseFloat(
            tickerRes.data.price || 
            tickerRes.data.markPrice || 
            tickerRes.data.lastPrice || 
            tickerRes.data.midPx
        );
        
        if (!isNaN(mark)) {
             price = Math.floor(mark * 0.5); 
             console.log(`   Current Price: ${mark}, Placing Buy at ${price}`);
        } else {
             console.warn(`   ⚠️ Ticker Price NaN. Using Default: ${price}`);
        }
    } else {
         console.warn(`   ⚠️ Get Ticker Failed: ${tickerRes.error}. Using Default: ${price}`);
    }
    
    // Construct params (as if from UI)
    // ...
    
    const apiParams = {
        symbol: symbol,
        side: 'BUY',
        type: 'LIMIT',
        quantity: exchange === 'hyperliquid' ? '0.01' : '0.01', // Increase Aster to 0.01 (>$5)
        price: price.toString(),
        timeInForce: 'GTC',
        exchange: exchange 
    };

    let orderId: string | undefined;

    // Call API: placeOrder
    const orderRes = await client.placeOrder(apiParams);
    if (orderRes.success) {
        console.log(`   ✅ Order Created: ID ${orderRes.data.orderId}`);
        orderId = orderRes.data.orderId;
    } else {
        console.error(`   ❌ Create Order Failed: ${orderRes.error}`);
    }

    // 4. Get Open Orders
    console.log(`[${exchange}] Get Open Orders...`);
    // Note: getOpenOrders(symbol, exchange)
    const ordersRes = await client.getOpenOrders(symbol, exchange);
    if (ordersRes.success) {
        console.log(`   ✅ Open Orders: ${ordersRes.data.length} found.`);
    } else {
        console.error(`   ❌ Get Open Orders Failed: ${ordersRes.error}`);
    }

    // 5. Cancel Order (if created)
    if (orderId) {
        console.log(`[${exchange}] Cancel Order ${orderId}...`);
        // Note: cancelOrder(orderId, symbol) - Session Context handles Exchange
        const cancelRes = await client.cancelOrder(orderId, symbol);
        if (cancelRes.success) {
            console.log(`   ✅ Cancelled.`);
        } else {
             console.error(`   ❌ Cancel Failed: ${cancelRes.error}`);
        }
    }

    // 6. Cancel All (Test Logic)
    console.log(`[${exchange}] Test Cancel All (dry run)...`);
    // Just call getOpenOrders again to ensure we can fetch list for CancelAll logic
    const ordersRes2 = await client.getOpenOrders(symbol, exchange); 
    if (ordersRes2.success) {
        console.log(`   ✅ Verified Open Orders fetch for Cancel All.`);
    }

    // 7. Get Positions & Close Logic Simulation
    console.log(`[${exchange}] Get Positions & Close Logic...`);
    const posRes = await client.getPositions(exchange);
    if (posRes.success) {
        console.log(`   ✅ Positions Fetched: ${posRes.data.length}`);
        const pos = posRes.data.find((p: any) => p.symbol === symbol);
        console.log(`   Position (${symbol}): ${pos ? 'Exists' : 'None'}`);
    } else {
        console.error(`   ❌ Failed Get Positions: ${posRes.error}`);
    }
}

runTests();
