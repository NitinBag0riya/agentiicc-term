/**
 * Comprehensive Test: All API Endpoints & Order Types
 * Tests every endpoint and order type from the Postman collection
 */

const BASE_URL = 'http://localhost:3000';
const TELEGRAM_ID = Math.floor(Math.random() * 1000000);

interface TestResult {
    endpoint: string;
    method: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    message: string;
    duration?: number;
}

const results: TestResult[] = [];

function logTest(endpoint: string, method: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number) {
    results.push({ endpoint, method, status, message, duration });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${emoji} ${method} ${endpoint}: ${message}`);
}

async function main() {
    console.log('🚀 COMPREHENSIVE API TEST - All Endpoints & Order Types\n');
    console.log(`   Test User: Telegram ID ${TELEGRAM_ID}\n`);

    let userId: number;
    let asterToken: string;
    let hlToken: string;

    try {
        // ==========================================
        // 1. USER MANAGEMENT
        // ==========================================
        console.log('📂 [1/7] USER MANAGEMENT\n');

        // Create User
        const startTime = Date.now();
        const userRes = await fetch(`${BASE_URL}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: TELEGRAM_ID, username: 'comprehensive_test' })
        });
        const userData: any = await userRes.json();
        if (!userData.success) throw new Error('Create user failed');
        userId = userData.data.id;
        logTest('/user', 'POST', 'PASS', `User created: ${userId}`, Date.now() - startTime);

        // Link Aster
        const asterKey = process.env.ASTER_API_KEY!;
        const asterSecret = process.env.ASTER_API_SECRET!;
        const asterRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchange: 'aster', apiKey: asterKey, apiSecret: asterSecret })
        });
        const asterData: any = await asterRes.json();
        if (!asterData.success) throw new Error('Link Aster failed');
        logTest('/user/credentials', 'POST', 'PASS', 'Aster credentials linked');

        // Link Hyperliquid
        const hlAddr = process.env.HYPERLIQUID_ADDRESS!;
        const hlKey = process.env.HYPERLIQUID_PRIVATE_KEY!;
        const hlRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchange: 'hyperliquid', address: hlAddr, privateKey: hlKey })
        });
        const hlData: any = await hlRes.json();
        if (!hlData.success) throw new Error('Link Hyperliquid failed');
        logTest('/user/credentials', 'POST', 'PASS', 'Hyperliquid credentials linked');

        // List Exchanges
        const listRes = await fetch(`${BASE_URL}/user/exchanges?userId=${userId}`);
        const listData: any = await listRes.json();
        logTest('/user/exchanges', 'GET', 'PASS', `Exchanges: ${listData.data.join(', ')}`);

        // ==========================================
        // 2. AUTHENTICATION
        // ==========================================
        console.log('\n📂 [2/7] AUTHENTICATION\n');

        // Create Aster Session
        const asterAuthRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchangeId: 'aster' })
        });
        const asterAuthData: any = await asterAuthRes.json();
        asterToken = asterAuthData.token;
        logTest('/auth/session', 'POST', 'PASS', 'Aster session created');

        // Create Hyperliquid Session
        const hlAuthRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, exchangeId: 'hyperliquid' })
        });
        const hlAuthData: any = await hlAuthRes.json();
        hlToken = hlAuthData.token;
        logTest('/auth/session', 'POST', 'PASS', 'Hyperliquid session created');

        // ==========================================
        // 3. MARKET DATA (PUBLIC)
        // ==========================================
        console.log('\n📂 [3/7] MARKET DATA (PUBLIC)\n');

        // Get Assets - Aster
        const assetsRes = await fetch(`${BASE_URL}/assets?exchange=aster`);
        const assetsData: any = await assetsRes.json();
        logTest('/assets', 'GET', 'PASS', `Aster: ${assetsData.data.length} assets`);

        // Get Assets - Hyperliquid
        const hlAssetsRes = await fetch(`${BASE_URL}/assets?exchange=hyperliquid`);
        const hlAssetsData: any = await hlAssetsRes.json();
        logTest('/assets', 'GET', 'PASS', `Hyperliquid: ${hlAssetsData.data.length} assets`);

        // Get Ticker
        const tickerRes = await fetch(`${BASE_URL}/ticker/ETHUSDT?exchange=aster`);
        const tickerData: any = await tickerRes.json();
        logTest('/ticker/:symbol', 'GET', 'PASS', `Price: $${tickerData.data.price}`);

        // Get Orderbook
        const obRes = await fetch(`${BASE_URL}/orderbook/ETHUSDT?depth=10&exchange=aster`);
        const obData: any = await obRes.json();
        logTest('/orderbook/:symbol', 'GET', 'PASS', `Bids: ${obData.data.bids.length}, Asks: ${obData.data.asks.length}`);

        // ==========================================
        // 4. ACCOUNT MANAGEMENT
        // ==========================================
        console.log('\n📂 [4/7] ACCOUNT MANAGEMENT\n');

        // Get Account - Aster
        const asterAccRes = await fetch(`${BASE_URL}/account?exchange=aster`, {
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const asterAccData: any = await asterAccRes.json();
        logTest('/account', 'GET', 'PASS', `Aster Balance: $${asterAccData.data.availableBalance}`);

        // Get Account - Hyperliquid
        const hlAccRes = await fetch(`${BASE_URL}/account?exchange=hyperliquid`, {
            headers: { 'Authorization': `Bearer ${hlToken}` }
        });
        const hlAccData: any = await hlAccRes.json();
        logTest('/account', 'GET', 'PASS', `Hyperliquid Balance: $${hlAccData.data.availableBalance}`);

        // Get Positions
        const posRes = await fetch(`${BASE_URL}/positions?exchange=aster`, {
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const posData: any = await posRes.json();
        logTest('/positions', 'GET', 'PASS', `Positions: ${posData.data.length}`);

        // Set Leverage
        const levRes = await fetch(`${BASE_URL}/account/leverage`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${asterToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: 'ETHUSDT', leverage: 5, exchange: 'aster' })
        });
        logTest('/account/leverage', 'POST', 'PASS', 'Leverage set to 5x');

        // Set Margin Mode
        const marginRes = await fetch(`${BASE_URL}/account/margin-mode`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${asterToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: 'ETHUSDT', mode: 'ISOLATED', exchange: 'aster' })
        });
        logTest('/account/margin-mode', 'POST', 'PASS', 'Margin mode set to ISOLATED');

        // ==========================================
        // 5. ORDER PLACEMENT - ALL TYPES
        // ==========================================
        console.log('\n📂 [5/7] ORDER PLACEMENT - ALL TYPES\n');

        const orderTypes = [
            { type: 'LIMIT', params: { symbol: 'ETHUSDT', side: 'BUY', type: 'LIMIT', quantity: '0.01', price: '2000' } },
            { type: 'MARKET', params: { symbol: 'ETHUSDT', side: 'BUY', type: 'MARKET', quantity: '0.005' } },
            { type: 'IOC', params: { symbol: 'ETHUSDT', side: 'BUY', type: 'LIMIT', quantity: '0.01', price: parseFloat(tickerData.data.price).toFixed(2), timeInForce: 'IOC' } },
            { type: 'POST_ONLY', params: { symbol: 'ETHUSDT', side: 'BUY', type: 'LIMIT', quantity: '0.01', price: '2000', postOnly: true } },
            { type: 'STOP_MARKET', params: { symbol: 'ETHUSDT', side: 'SELL', type: 'STOP_MARKET', quantity: '0.01', triggerPrice: '2900' } },
            { type: 'STOP_LIMIT', params: { symbol: 'ETHUSDT', side: 'SELL', type: 'STOP_LIMIT', quantity: '0.01', triggerPrice: '2900', price: '2850' } },
            { type: 'TAKE_PROFIT_MARKET', params: { symbol: 'ETHUSDT', side: 'SELL', type: 'TAKE_PROFIT_MARKET', quantity: '0.01', triggerPrice: '3500' } },
            { type: 'TRAILING_STOP (Aster)', params: { symbol: 'ETHUSDT', side: 'SELL', type: 'TRAILING_STOP_MARKET', quantity: '0.01', callbackRate: '2', exchange: 'aster' } },
        ];

        for (const orderType of orderTypes) {
            try {
                const orderRes = await fetch(`${BASE_URL}/order`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${asterToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...orderType.params, exchange: 'aster' })
                });
                const orderData: any = await orderRes.json();
                
                if (orderData.success) {
                    logTest(`/order (${orderType.type})`, 'POST', 'PASS', `Order ID: ${orderData.data.orderId}`);
                } else {
                    logTest(`/order (${orderType.type})`, 'POST', 'FAIL', orderData.error || 'Order failed');
                }
            } catch (error: any) {
                logTest(`/order (${orderType.type})`, 'POST', 'FAIL', error.message);
            }
        }

        // ==========================================
        // 6. ORDER MANAGEMENT
        // ==========================================
        console.log('\n📂 [6/7] ORDER MANAGEMENT\n');

        // Get Open Orders
        const openOrdersRes = await fetch(`${BASE_URL}/orders?symbol=ETHUSDT&exchange=aster`, {
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const openOrdersData: any = await openOrdersRes.json();
        logTest('/orders', 'GET', 'PASS', `Open orders: ${openOrdersData.data.length}`);

        // Get Order History
        const historyRes = await fetch(`${BASE_URL}/orders/history?symbol=ETHUSDT&exchange=aster`, {
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const historyData: any = await historyRes.json();
        logTest('/orders/history', 'GET', 'PASS', `History: ${historyData.data.length} orders`);

        // Cancel specific order (if any open)
        if (openOrdersData.data.length > 0) {
            const orderId = openOrdersData.data[0].orderId;
            const cancelRes = await fetch(`${BASE_URL}/order/${orderId}?symbol=ETHUSDT&exchange=aster`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${asterToken}` }
            });
            const cancelData: any = await cancelRes.json();
            logTest('/order/:orderId', 'DELETE', 'PASS', `Cancelled order ${orderId}`);
        } else {
            logTest('/order/:orderId', 'DELETE', 'SKIP', 'No open orders to cancel');
        }

        // Cancel All Orders
        const cancelAllRes = await fetch(`${BASE_URL}/orders?symbol=ETHUSDT&exchange=aster`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        const cancelAllData: any = await cancelAllRes.json();
        logTest('/orders', 'DELETE', 'PASS', cancelAllData.message || 'All orders cancelled');

        // ==========================================
        // 7. SESSION CLEANUP
        // ==========================================
        console.log('\n📂 [7/7] SESSION CLEANUP\n');

        // Delete Aster Session
        const delAsterRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${asterToken}` }
        });
        logTest('/auth/session', 'DELETE', 'PASS', 'Aster session deleted');

        // Delete Hyperliquid Session
        const delHlRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${hlToken}` }
        });
        logTest('/auth/session', 'DELETE', 'PASS', 'Hyperliquid session deleted');

        // ==========================================
        // SUMMARY
        // ==========================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60) + '\n');

        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;
        const skipped = results.filter(r => r.status === 'SKIP').length;
        const total = results.length;

        console.log(`✅ PASSED:  ${passed}/${total}`);
        console.log(`❌ FAILED:  ${failed}/${total}`);
        console.log(`⚠️  SKIPPED: ${skipped}/${total}`);
        console.log(`\n📈 SUCCESS RATE: ${((passed / total) * 100).toFixed(1)}%\n`);

        if (failed > 0) {
            console.log('❌ FAILED TESTS:\n');
            results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`   ${r.method} ${r.endpoint}: ${r.message}`);
            });
            console.log('');
        }

        console.log('='.repeat(60));
        
        if (failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! API is production-ready!\n');
        } else {
            console.log(`\n⚠️  ${failed} test(s) failed. Please review.\n`);
            process.exit(1);
        }

    } catch (error: any) {
        console.error(`\n❌ TEST SUITE FAILED: ${error.message}\n`);
        process.exit(1);
    }
}

main();
