
import { UniversalApiClient } from '../src/services/universalApi';
import { getPostgres, connectPostgres, disconnectPostgres } from '../src/db/postgres';
import dotenv from 'dotenv';
import { AsterWriteOpSchema } from '../src/aster/writeOps';

dotenv.config();

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('🚀 Starting Comprehensive Lifecycle Test...');
    
    // Config
    const userId = 77777; 
    const telegramId = 77777777;
    const targetExchange = process.argv[2] || 'aster'; // 'aster' or 'hyperliquid'
    const exchange = targetExchange.toLowerCase();
    const symbol = exchange === 'hyperliquid' ? 'ETH' : 'ETHUSDT'; // Test symbol (Cheaper than BTC for low balance tests)

    console.log(`🎯 Target: ${exchange.toUpperCase()} | Symbol: ${symbol}`);


    // Credentials Setup
    let credentials: any = {};
    if (exchange === 'aster') {
        const apiKey = process.env.ASTER_API_KEY;
        const apiSecret = process.env.ASTER_API_SECRET;
        if (!apiKey || !apiSecret) { console.error('❌ Missing ASTER creds'); process.exit(1); }
        credentials = { apiKey, apiSecret };
    } else if (exchange === 'hyperliquid') {
        const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
        const address = process.env.HYPERLIQUID_ADDRESS;
        if (!privateKey || !address) { console.error('❌ Missing HERLIQUID creds'); process.exit(1); }
        credentials = { privateKey, address };
    } else {
        console.error('❌ Unknown exchange'); process.exit(1);
    }

    const client = new UniversalApiClient();
    
    try {
        await connectPostgres();
        const db = getPostgres();

        // 0. Ensure User Exists
        await db.query(`
            INSERT INTO users (id, telegram_id, username, created_at)
            VALUES ($1, $2, 'lifecycle_tester', NOW())
            ON CONFLICT (id) DO NOTHING
        `, [userId, telegramId]);

        // 1. Auth & Session
        console.log('\n🔐 Authenticating...');
        const linkRes = await client.linkCredentials(userId, exchange, credentials);
        if (!linkRes.success) throw new Error('Link Failed: ' + linkRes.error);
        
        const initRes = await client.initSession(userId);
        if (!initRes) throw new Error('Session Init Failed');
        console.log('✅ Authenticated');

        // 1.5 Clean up existing orders to free margin
        console.log('\n🧹 Cleaning up any existing open orders...');
        const cancelAllInit = await client.cancelAllOrders(symbol, exchange);
        if (cancelAllInit.success) console.log('   ✅ Cancelled existing orders');
        else console.warn('   ⚠️ cleanup warning:', cancelAllInit.error);

        await sleep(1000);

        // 2. Check Initial Position & Balance
        console.log('\n📊 Checking Initial Position & Balance...');
        const [posRes, accountRes] = await Promise.all([
            client.getPositions(exchange),
            client.getAccount(exchange)
        ]);

        if (accountRes.success) {
            console.log(`💰 Available Balance: ${accountRes.data.availableBalance} USDT`);
        } else {
            console.error('⚠️ Failed to fetch account:', accountRes.error);
        }

        if (posRes.success) {
            const pos = posRes.data.find((p: any) => p.symbol === symbol);
            console.log('Current Position:', pos ? `${pos.positionAmt} ${symbol} (PnL: ${pos.unRealizedProfit})` : 'None');
        }

        // 3. Test LIMIT Order (Place & Cancel)
        const quantity = '0.005'; // 0.005 ETH @ 3500 = $17.5. Margin @ 5x = $3.5. Fits in $5 balance.
        // 1. Testing LIMIT Order (In & Out) - Price closer to market for Hyperliquid validation
        const safeLimitPrice = '2500'; // $2500 is ~25% below $3300, valid and safe from fill
        console.log(`\n1️⃣  Testing LIMIT Order (In & Out) @ ${safeLimitPrice}...`);
        
        const limitRes = await client.placeOrder({
            symbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity,
            price: safeLimitPrice,
            timeInForce: 'GTC',
            leverage: 5,
            exchange
        });

        if (!limitRes.success) {
            console.error('   ❌ LIMIT Order Failed:', limitRes.error);
        } else {
            console.log('   ✅ LIMIT Order Placed. ID:', limitRes.data.orderId);
            await sleep(1000);
            
            console.log('   -> Cancelling LIMIT Order...');
            const cancelRes = await client.cancelOrder(String(limitRes.data.orderId), symbol);
            if (cancelRes.success) console.log('   ✅ LIMIT Order Cancelled');
            else console.error('   ❌ Cancel Failed:', cancelRes.error);
        }

        // 4. Test MARKET Order (Open Position)
        // Market Order & Full Lifecycle (Enabled for ALL exchanges requested)
        console.log('\n2️⃣  Testing MARKET Order (Open Position)...');
        // Check price first to verify min notional
        // But we'll just send a small reasonable amount.
        
        console.log(`   -> Placing MARKET BUY ${quantity} ${symbol}`);
        const marketRes = await client.placeOrder({
            symbol,
            side: 'BUY',
            type: 'MARKET',
            quantity,
            leverage: 5,
            exchange
        });

        if (!marketRes.success) {
            console.error('   ❌ MARKET Order Failed:', marketRes.error);
        } else {
            console.log('   ✅ MARKET Order Filled. ID:', marketRes.data.orderId);
            await sleep(2000);

            // 5. Test Conditional Orders (TP/SL)
            console.log('\n3️⃣  Testing Conditional Orders (TP/SL)...');
            
            // TP
            console.log('   -> Placing TAKE_PROFIT...');
            const tpRes = await client.placeOrder({
                symbol,
                side: 'SELL', // Close Buy
                type: 'TAKE_PROFIT_MARKET',
                quantity, // Required for Hyperliquid
                stopPrice: '90000', // High price
                closePosition: 'true',
                exchange
            });
            if(tpRes.success) console.log('   ✅ TP Placed');
            else console.error('   ❌ TP Failed:', tpRes.error);

            // SL
            console.log('   -> Placing STOP_MARKET...');
            const slRes = await client.placeOrder({
                symbol,
                side: 'SELL',
                type: 'STOP_MARKET',
                quantity, // Required for Hyperliquid
                stopPrice: '1000', // Low price
                closePosition: 'true',
                exchange
            });
            if(slRes.success) console.log('   ✅ SL Placed');
            else console.error('   ❌ SL Failed:', slRes.error);

            await sleep(1000);

            // 6. Cancel All Orders (Cleanup TP/SL)
            console.log('\n4️⃣  Testing Cancel All Orders...');
            const cancelAllRes = await client.cancelAllOrders(symbol, exchange);
            if(cancelAllRes.success) console.log('   ✅ All Orders Cancelled');
            else console.error('   ❌ Cancel All Failed:', cancelAllRes.error);

            // 7. Close Position
            console.log('\n5️⃣  Closing Position...');
            const closeRes = await client.closePosition(symbol); // Note: ClosePositionOp uses UniversalApi.closePosition which usually sends MARKET CLOSE
            if(closeRes.success) console.log('   ✅ Position Closed');
            else console.error('   ❌ Close Position Failed:', closeRes.error);
        }

    } catch (err: any) {
        console.error('\n❌ FATAL ERROR:', err.message);
    } finally {
        await disconnectPostgres();
        console.log('\n🏁 Test Complete.');
    }
}

main();
