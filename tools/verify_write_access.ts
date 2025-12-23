
import { UniversalApiClient } from '../src/services/universalApi';
import dotenv from 'dotenv';

dotenv.config();

import { getPostgres, connectPostgres, disconnectPostgres } from '../src/db/postgres';

async function main() {
    console.log('🧪 Verifying Write Access (Order Placement)...');
    
    // Config from .env
    const userId = 77777; // Test user ID
    const telegramId = 77777777; // Test telegram ID
    const targetExchange = process.argv[2] || 'aster'; // 'aster' or 'hyperliquid' from command line
    const exchange = targetExchange.toLowerCase();

    console.log(`🎯 Target Exchange: ${exchange}`);

    let credentials: any = {};
    
    if (exchange === 'aster') {
        const apiKey = process.env.ASTER_API_KEY;
        const apiSecret = process.env.ASTER_API_SECRET;
        if (!apiKey || !apiSecret) {
            console.error('❌ Missing ASTER_API_KEY or ASTER_API_SECRET in .env');
            process.exit(1);
        }
        credentials = { apiKey, apiSecret };
    } else if (exchange === 'hyperliquid') {
        const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
        const mainAddress = process.env.HYPERLIQUID_ADDRESS;
        if (!privateKey || !mainAddress) {
            console.error('❌ Missing HYPERLIQUID_PRIVATE_KEY or HYPERLIQUID_ADDRESS in .env');
            process.exit(1);
        }
        credentials = { 
            privateKey: privateKey, 
            address: mainAddress 
        };
    } else {
        console.error('❌ Unknown exchange. Use "aster" or "hyperliquid"');
        process.exit(1);
    }



    const client = new UniversalApiClient();
    
    // Connect to DB
    await connectPostgres();
    const db = getPostgres();

    try {
        // 0. Ensure User Exists (to avoid FK errors)
        console.log('👤 Ensuring Test User Exists...');
        await db.query(`
            INSERT INTO users (id, telegram_id, username, created_at)
            VALUES ($1, $2, 'test_user', NOW())
            ON CONFLICT (id) DO NOTHING
        `, [userId, telegramId]);

        // 1. Link Credentials
        console.log('🔗 Linking Credentials...');
        const linkRes = await client.linkCredentials(userId, exchange, credentials);
        if (!linkRes.success) {
            throw new Error(`Link Failed: ${linkRes.error}`);
        }

        // 2. Init Session
        console.log('🔄 Initializing Session...');
        const initRes = await client.initSession(userId);
        if (!initRes) {
             throw new Error('Session Init Failed');
        }

        // 3. Place Test Order (LIMIT BUY far below price)
        console.log('📝 Placing Test Order (Limit Buy BTCUSDT @ $1000)...');
        // Note: placeOrder(orderData)
        const orderRes = await client.placeOrder({
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01', // $10 @ $1000 price, meets min notional
            price: '1000', // Very low price to avoid fill
            leverage: 5,
            exchange: exchange 
            // UniversalApi.placeOrder sends body. writeEngine sends { ...apiParams, exchange: 'aster' }.
        });

        if (orderRes.success) {
            console.log('✅ Order Placed Successfully!');
            console.log('Order Details:', orderRes.data);

            // 4. Cancel the order immediately to clean up
            const orderId = orderRes.data.orderId; // Adjust based on actual response structure
            if (orderId) {
                console.log(`🚫 Cancelling Order ${orderId}...`);
                // Note: cancelOrder(orderId, symbol)
                const cancelRes = await client.cancelOrder(String(orderId), 'BTCUSDT');
                
                if (cancelRes.success) {
                    console.log('✅ Order Cancelled Successfully!');
                } else {
                    console.error('⚠️ Failed to Cancel Order:', cancelRes.error);
                }
            } else {
                console.warn('⚠️ No orderId returned, cannot cancel automatically.');
            }

        } else {
            console.error('❌ Order Placement Failed:', orderRes.error);
             // If error is "Insufficient margin" etc, that proves write access at least reached the exchange!
            if (orderRes.error && (orderRes.error.includes('balance') || orderRes.error.includes('margin'))) {
                 console.log('✅ Write access confirmed (Request reached exchange, rejected due to funds).');
            }
        }

    } catch (err: any) {
        console.error('❌ Fatal Error:', err.message);
    } finally {
        await disconnectPostgres();
    }
}

main();
