/**
 * Comprehensive Test: ALL Order Types on BOTH Exchanges
 * Tests Aster and Hyperliquid with all supported order types
 */

const BASE_URL = 'http://localhost:3000';
const TELEGRAM_ID = Math.floor(Math.random() * 1000000);

interface TestResult {
    exchange: string;
    endpoint: string;
    method: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    message: string;
}

const results: TestResult[] = [];

function logTest(exchange: string, endpoint: string, method: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string) {
    results.push({ exchange, endpoint, method, status, message });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${emoji} [${exchange.toUpperCase()}] ${method} ${endpoint}: ${message}`);
}

async function testExchange(exchangeId: string, token: string) {
    const symbol = exchangeId === 'aster' ? 'ETHUSDT' : 'ETH';
    
    console.log(`\n📂 [${exchangeId.toUpperCase()}] ORDER PLACEMENT - ALL TYPES\n`);

    // Get exchange info to determine tick size
    let tickSize = 0.01; // Default
    if (exchangeId === 'aster') {
        try {
            const assetsRes = await fetch(`${BASE_URL}/assets?exchange=aster`);
            const assetsData: any = await assetsRes.json();
            const asset = assetsData.data.find((a: any) => a.symbol === symbol);
            if (asset?.tickSize) {
                tickSize = parseFloat(asset.tickSize);
            }
        } catch (e) {
            console.warn('   ⚠️ Could not fetch tick size, using default 0.01');
        }
    }

    // Get current price for dynamic pricing
    const tickerRes = await fetch(`${BASE_URL}/ticker/${symbol}?exchange=${exchangeId}`);
    const tickerData: any = await tickerRes.json();
    
    if (!tickerData || !tickerData.data || !tickerData.data.price) {
        throw new Error(`Failed to get ticker data for ${symbol} on ${exchangeId}: ${JSON.stringify(tickerData)}`);
    }
    
    const currentPrice = parseFloat(tickerData.data.price);
    
    // Helper to round price to tick size
    const roundToTickSize = (price: number): string => {
        const rounded = Math.round(price / tickSize) * tickSize;
        // Format to match tick size decimals
        const decimals = tickSize.toString().split('.')[1]?.length || 0;
        return rounded.toFixed(decimals);
    };
    
    // For limit orders, use 95% of market price to ensure minimum notional is met
    // (65% was too low and caused notional < $5 errors)
    const lowPrice = roundToTickSize(currentPrice * 0.95); // 5% below market
    const marketPrice = roundToTickSize(currentPrice);
    
    // Minimum notional: $5 for Aster, $10 for Hyperliquid
    const minNotional = exchangeId === 'aster' ? 5 : 10;
    const quantity = (minNotional / currentPrice * 1.1).toFixed(3); // 10% above minimum
    
    const orderTypes = [
        {
            name: 'LIMIT',
            params: { symbol, side: 'BUY', type: 'LIMIT', quantity, price: lowPrice }
        },
        {
            name: 'MARKET',
            params: { symbol, side: 'BUY', type: 'MARKET', quantity }
        },
        {
            name: 'IOC',
            params: { symbol, side: 'BUY', type: 'LIMIT', quantity, price: marketPrice, timeInForce: 'IOC' }
        },
        {
            name: 'POST_ONLY',
            params: { symbol, side: 'BUY', type: 'LIMIT', quantity, price: lowPrice, postOnly: true }
        },
        {
            name: 'STOP_MARKET',
            params: { symbol, side: 'SELL', type: 'STOP_MARKET', quantity, triggerPrice: roundToTickSize(currentPrice * 0.95) }
        },
        {
            name: 'STOP_LIMIT',
            // Use 94% for trigger and 93.5% for limit to ensure limit >= trigger - 1%
            params: { symbol, side: 'SELL', type: 'STOP_LIMIT', quantity, triggerPrice: roundToTickSize(currentPrice * 0.94), price: roundToTickSize(currentPrice * 0.935) }
        },
        {
            name: 'TAKE_PROFIT_MARKET',
            params: { symbol, side: 'SELL', type: 'TAKE_PROFIT_MARKET', quantity, triggerPrice: roundToTickSize(currentPrice * 1.15) }
        },
        {
            name: 'TRAILING_STOP',
            params: { symbol, side: 'SELL', type: 'TRAILING_STOP_MARKET', quantity, callbackRate: '2' },
            skip: exchangeId === 'hyperliquid' // Aster only
        }
    ];

    for (const orderType of orderTypes) {
        if (orderType.skip) {
            logTest(exchangeId, `/order (${orderType.name})`, 'POST', 'SKIP', 'Not supported on this exchange');
            continue;
        }

        try {
            const orderRes = await fetch(`${BASE_URL}/order`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...orderType.params, exchange: exchangeId })
            });
            const orderData: any = await orderRes.json();
            
            if (orderData.success) {
                logTest(exchangeId, `/order (${orderType.name})`, 'POST', 'PASS', `Order ID: ${orderData.data.orderId}`);
            } else {
                logTest(exchangeId, `/order (${orderType.name})`, 'POST', 'FAIL', orderData.error || 'Order failed');
            }
        } catch (error: any) {
            logTest(exchangeId, `/order (${orderType.name})`, 'POST', 'FAIL', error.message);
        }
    }

    // Order Management
    console.log(`\n📂 [${exchangeId.toUpperCase()}] ORDER MANAGEMENT\n`);

    // Get Open Orders
    try {
        const openOrdersRes = await fetch(`${BASE_URL}/orders?symbol=${symbol}&exchange=${exchangeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const openOrdersData: any = await openOrdersRes.json();
        
        if (openOrdersData && openOrdersData.data) {
            logTest(exchangeId, '/orders', 'GET', 'PASS', `Open orders: ${openOrdersData.data.length}`);
        } else {
            logTest(exchangeId, '/orders', 'GET', 'FAIL', `Invalid response: ${JSON.stringify(openOrdersData)}`);
        }
    } catch (error: any) {
        logTest(exchangeId, '/orders', 'GET', 'FAIL', error.message);
    }

    // Cancel All Orders
    try {
        const cancelAllRes = await fetch(`${BASE_URL}/orders?symbol=${symbol}&exchange=${exchangeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cancelAllData: any = await cancelAllRes.json();
        
        if (cancelAllData) {
            const message = cancelAllData.message || `Cancelled ${cancelAllData.canceledCount || 0} orders`;
            logTest(exchangeId, '/orders', 'DELETE', 'PASS', message);
        } else {
            logTest(exchangeId, '/orders', 'DELETE', 'FAIL', 'Invalid response');
        }
    } catch (error: any) {
        logTest(exchangeId, '/orders', 'DELETE', 'FAIL', error.message);
    }
}

async function main() {
    console.log('🚀 COMPREHENSIVE TEST - ALL ORDER TYPES ON BOTH EXCHANGES\n');
    console.log(`   Test User: Telegram ID ${TELEGRAM_ID}\n`);

    let userId: number;
    let asterToken: string;
    let hlToken: string;

    try {
        // ==========================================
        // 1. SETUP
        // ==========================================
        console.log('📂 [SETUP] User Management & Authentication\n');

        // Create User
        const userRes = await fetch(`${BASE_URL}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: TELEGRAM_ID, username: 'dual_exchange_test' })
        });
        const userData: any = await userRes.json();
        userId = userData.data.id;
        console.log(`   ✅ User created: ${userId}`);

        // Link Aster
        const asterRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                exchange: 'aster',
                apiKey: process.env.ASTER_API_KEY!,
                apiSecret: process.env.ASTER_API_SECRET!
            })
        });
        console.log(`   ✅ Aster credentials linked`);

        // Link Hyperliquid
        const hlRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                exchange: 'hyperliquid',
                address: process.env.HYPERLIQUID_ADDRESS!,
                privateKey: process.env.HYPERLIQUID_PRIVATE_KEY!
            })
        });
        console.log(`   ✅ Hyperliquid credentials linked`);

        // Create Sessions
        const asterAuthRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchangeId: 'aster' })
        });
        asterToken = (await asterAuthRes.json()).token;
        console.log(`   ✅ Aster session created`);

        const hlAuthRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchangeId: 'hyperliquid' })
        });
        hlToken = (await hlAuthRes.json()).token;
        console.log(`   ✅ Hyperliquid session created`);

        // Get Account Balances
        const asterAccRes = await fetch(`${BASE_URL}/account?exchange=aster`, {
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const asterAccData: any = await asterAccRes.json();
        const asterBalance = asterAccData?.data?.availableBalance || '0';
        console.log(`   💰 Aster Balance: $${asterBalance}`);

        const hlAccRes = await fetch(`${BASE_URL}/account?exchange=hyperliquid`, {
            headers: { 'Authorization': `Bearer ${hlToken}` }
        });
        const hlAccData: any = await hlAccRes.json();
        const hlBalance = hlAccData?.data?.availableBalance || '0';
        console.log(`   💰 Hyperliquid Balance: $${hlBalance}`);

        // ==========================================
        // 2. TEST BOTH EXCHANGES
        // ==========================================
        await testExchange('aster', asterToken);
        await testExchange('hyperliquid', hlToken);

        // ==========================================
        // 3. SUMMARY
        // ==========================================
        console.log('\n' + '='.repeat(70));
        console.log('📊 TEST SUMMARY - BOTH EXCHANGES');
        console.log('='.repeat(70) + '\n');

        const asterResults = results.filter(r => r.exchange === 'aster');
        const hlResults = results.filter(r => r.exchange === 'hyperliquid');

        const asterPassed = asterResults.filter(r => r.status === 'PASS').length;
        const asterFailed = asterResults.filter(r => r.status === 'FAIL').length;
        const asterSkipped = asterResults.filter(r => r.status === 'SKIP').length;

        const hlPassed = hlResults.filter(r => r.status === 'PASS').length;
        const hlFailed = hlResults.filter(r => r.status === 'FAIL').length;
        const hlSkipped = hlResults.filter(r => r.status === 'SKIP').length;

        const totalPassed = asterPassed + hlPassed;
        const totalFailed = asterFailed + hlFailed;
        const totalSkipped = asterSkipped + hlSkipped;
        const total = results.length;

        console.log('🌟 ASTER EXCHANGE:');
        console.log(`   ✅ PASSED:  ${asterPassed}/${asterResults.length}`);
        console.log(`   ❌ FAILED:  ${asterFailed}/${asterResults.length}`);
        console.log(`   ⚠️  SKIPPED: ${asterSkipped}/${asterResults.length}`);
        console.log(`   📈 SUCCESS: ${((asterPassed / (asterResults.length - asterSkipped)) * 100).toFixed(1)}%\n`);

        console.log('⚡ HYPERLIQUID EXCHANGE:');
        console.log(`   ✅ PASSED:  ${hlPassed}/${hlResults.length}`);
        console.log(`   ❌ FAILED:  ${hlFailed}/${hlResults.length}`);
        console.log(`   ⚠️  SKIPPED: ${hlSkipped}/${hlResults.length}`);
        console.log(`   📈 SUCCESS: ${((hlPassed / (hlResults.length - hlSkipped)) * 100).toFixed(1)}%\n`);

        console.log('🎯 OVERALL:');
        console.log(`   ✅ PASSED:  ${totalPassed}/${total}`);
        console.log(`   ❌ FAILED:  ${totalFailed}/${total}`);
        console.log(`   ⚠️  SKIPPED: ${totalSkipped}/${total}`);
        console.log(`   📈 SUCCESS: ${((totalPassed / (total - totalSkipped)) * 100).toFixed(1)}%\n`);

        if (totalFailed > 0) {
            console.log('❌ FAILED TESTS:\n');
            results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`   [${r.exchange.toUpperCase()}] ${r.method} ${r.endpoint}: ${r.message}`);
            });
            console.log('');
        }

        console.log('='.repeat(70));
        
        if (totalFailed === 0) {
            console.log('\n🎉 ALL TESTS PASSED ON BOTH EXCHANGES!\n');
        } else {
            console.log(`\n⚠️  ${totalFailed} test(s) failed. Review above.\n`);
        }

    } catch (error: any) {
        console.error(`\n❌ TEST SUITE FAILED: ${error.message}\n`);
        process.exit(1);
    }
}

main();
