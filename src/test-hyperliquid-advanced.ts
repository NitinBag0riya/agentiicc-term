import 'dotenv/config';
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';
import { Decimal } from 'decimal.js';

const ENV_PRIVATE_KEY = (process.env.HYPERLIQUID_PRIVATE_KEY || '').trim();
const ENV_ADDRESS = (process.env.HYPERLIQUID_ADDRESS || '').trim();

(async () => {
    console.log('\n🚀 \x1b[36mHyperliquid Advanced Features Test\x1b[0m 🚀\n');

    // Ensure 0x prefix
    let privateKey = ENV_PRIVATE_KEY;
    if (privateKey && !privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
    }

    const adapter = new HyperliquidAdapter(ENV_ADDRESS, privateKey);

    try {
        // 1. Get Account Info
        console.log('📊 Fetching Account Info...');
        const account = await adapter.getAccount();
        console.log(`   Balance: $${account.totalBalance}`);
        console.log(`   Available: $${account.availableBalance}\n`);

        // 2. Get Market Data
        const symbol = 'ETH';
        console.log(`📈 Fetching ${symbol} Market Data...`);
        const ticker = await adapter.getTicker(symbol);
        const currentPrice = new Decimal(ticker.price);
        console.log(`   Current Price: $${currentPrice.toString()}\n`);

        // Test 1: MARKET ORDER (Aggressive Limit)
        console.log('🔵 Test 1: Market Order (Aggressive Limit IOC)');
        try {
            const marketOrder = await adapter.placeOrder({
                symbol,
                side: 'BUY',
                type: 'MARKET',
                quantity: '0.001'
            });
            console.log(`   ✅ Market Order: ${marketOrder.orderId}, Status: ${marketOrder.status}\n`);
        } catch (e: any) {
            console.log(`   ⚠️  Market Order Failed: ${e.message}\n`);
        }

        // Test 2: LIMIT ORDER with Post-Only
        console.log('🟢 Test 2: Limit Order (Post-Only / ALO)');
        const limitPrice = currentPrice.mul(0.95).toDecimalPlaces(0).toString();
        try {
            const limitOrder = await adapter.placeOrder({
                symbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: '0.005',
                price: limitPrice,
                postOnly: true
            });
            console.log(`   ✅ Limit Order: ${limitOrder.orderId}, Price: $${limitPrice}\n`);
        } catch (e: any) {
            console.log(`   ⚠️  Limit Order Failed: ${e.message}\n`);
        }

        // Test 3: STOP-LOSS ORDER
        console.log('🔴 Test 3: Stop-Loss Order (Trigger)');
        const stopPrice = currentPrice.mul(0.90).toDecimalPlaces(0).toString();
        try {
            const stopOrder = await adapter.placeOrder({
                symbol,
                side: 'SELL',
                type: 'STOP_MARKET',
                quantity: '0.005',
                triggerPrice: stopPrice,
                reduceOnly: true
            });
            console.log(`   ✅ Stop-Loss: ${stopOrder.orderId}, Trigger: $${stopPrice}\n`);
        } catch (e: any) {
            console.log(`   ⚠️  Stop-Loss Failed: ${e.message}\n`);
        }

        // Test 4: TAKE-PROFIT ORDER
        console.log('🟡 Test 4: Take-Profit Order (Trigger)');
        const tpPrice = currentPrice.mul(1.10).toDecimalPlaces(0).toString();
        try {
            const tpOrder = await adapter.placeOrder({
                symbol,
                side: 'SELL',
                type: 'TAKE_PROFIT_MARKET',
                quantity: '0.005',
                triggerPrice: tpPrice,
                reduceOnly: true
            });
            console.log(`   ✅ Take-Profit: ${tpOrder.orderId}, Trigger: $${tpPrice}\n`);
        } catch (e: any) {
            console.log(`   ⚠️  Take-Profit Failed: ${e.message}\n`);
        }

        // Test 5: LIMIT ORDER with TP/SL Attachment
        console.log('🟣 Test 5: Limit Order with TP/SL Attachment');
        const entryPrice = currentPrice.mul(0.98).toDecimalPlaces(0).toString();
        const tpAttach = currentPrice.mul(1.05).toDecimalPlaces(0).toString();
        const slAttach = currentPrice.mul(0.93).toDecimalPlaces(0).toString();
        
        try {
            const orderWithTPSL = await adapter.placeOrder({
                symbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: '0.005',
                price: entryPrice,
                takeProfit: tpAttach,
                stopLoss: slAttach
            });
            console.log(`   ✅ Entry Order: ${orderWithTPSL.orderId}, Price: $${entryPrice}`);
            console.log(`   📈 TP: $${tpAttach}, 📉 SL: $${slAttach}\n`);
            
            // Wait a bit for TP/SL to be placed
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e: any) {
            console.log(`   ⚠️  Order with TP/SL Failed: ${e.message}\n`);
        }

        // Test 6: IOC ORDER
        console.log('⚡ Test 6: IOC Order (Immediate or Cancel)');
        const iocPrice = currentPrice.mul(1.01).toDecimalPlaces(0).toString();
        try {
            const iocOrder = await adapter.placeOrder({
                symbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: '0.005',
                price: iocPrice,
                timeInForce: 'IOC'
            });
            console.log(`   ✅ IOC Order: ${iocOrder.orderId}, Status: ${iocOrder.status}\n`);
        } catch (e: any) {
            console.log(`   ⚠️  IOC Order Failed: ${e.message}\n`);
        }

        // Test 7: Get Open Orders
        console.log('📋 Test 7: Fetching Open Orders');
        const openOrders = await adapter.getOpenOrders(symbol);
        console.log(`   Found ${openOrders.length} open orders for ${symbol}`);
        openOrders.slice(0, 3).forEach(order => {
            console.log(`   - ${order.orderId}: ${order.side} ${order.quantity} @ $${order.price}`);
        });
        console.log();

        // Test 8: Cancel All Orders
        if (openOrders.length > 0) {
            console.log('🗑️  Test 8: Cancel All Orders');
            const cancelResult = await adapter.cancelAllOrders(symbol);
            console.log(`   ${cancelResult.success ? '✅' : '⚠️'} ${cancelResult.message}\n`);
        }

        console.log('🎉 \x1b[32mAll Advanced Features Tested!\x1b[0m\n');

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
    }
})();
