import 'dotenv/config';

const API_BASE = 'http://localhost:3000';
const ASTER_API_KEY = process.env.ASTER_API_KEY || '';
const ASTER_API_SECRET = process.env.ASTER_API_SECRET || '';

interface TestResult {
    endpoint: string;
    method: string;
    exchange: string;
    status: 'PASS' | 'FAIL';
    statusCode?: number;
    error?: string;
    response?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
    endpoint: string,
    method: string = 'GET',
    exchange: string = 'aster',
    body?: any,
    requiresAuth: boolean = false
): Promise<TestResult> {
    const url = `${API_BASE}${endpoint}`;
    const headers: any = {
        'Content-Type': 'application/json'
    };

    if (requiresAuth) {
        headers['X-API-KEY'] = ASTER_API_KEY;
        headers['X-API-SECRET'] = ASTER_API_SECRET;
    }

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json();

        if (response.ok && data.success !== false) {
            return {
                endpoint,
                method,
                exchange,
                status: 'PASS',
                statusCode: response.status,
                response: data
            };
        } else {
            return {
                endpoint,
                method,
                exchange,
                status: 'FAIL',
                statusCode: response.status,
                error: data.error || data.message || 'Unknown error',
                response: data
            };
        }
    } catch (error: any) {
        return {
            endpoint,
            method,
            exchange,
            status: 'FAIL',
            error: error.message
        };
    }
}

function printResult(result: TestResult) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const color = result.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${icon} ${color}${result.method} ${result.endpoint}${reset} [${result.exchange}]`);
    if (result.status === 'FAIL') {
        console.log(`   Error: ${result.error}`);
    }
    if (result.statusCode) {
        console.log(`   Status: ${result.statusCode}`);
    }
}

function printSummary() {
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log('='.repeat(60) + '\n');

    if (failed > 0) {
        console.log('❌ FAILED TESTS:\n');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   ${r.method} ${r.endpoint} [${r.exchange}]`);
            console.log(`   └─ ${r.error}\n`);
        });
    }
}

(async () => {
    console.log('\n🚀 \x1b[36mUniversal API Comprehensive Test Suite\x1b[0m\n');
    console.log('Testing all endpoints for Aster and Hyperliquid...\n');

    // ========================================
    // PUBLIC ENDPOINTS (No Auth Required)
    // ========================================
    console.log('\n📖 PUBLIC ENDPOINTS\n');

    // Health Check
    let result = await testEndpoint('/health', 'GET', 'system');
    printResult(result);
    results.push(result);

    // Assets - Aster
    result = await testEndpoint('/assets?exchange=aster', 'GET', 'aster');
    printResult(result);
    results.push(result);

    // Assets - Hyperliquid
    result = await testEndpoint('/assets?exchange=hyperliquid', 'GET', 'hyperliquid');
    printResult(result);
    results.push(result);

    // Assets Search
    result = await testEndpoint('/assets/search?q=ETH', 'GET', 'both');
    printResult(result);
    results.push(result);

    // Ticker - Aster
    result = await testEndpoint('/ticker/ETHUSDT?exchange=aster', 'GET', 'aster');
    printResult(result);
    results.push(result);

    // Ticker - Hyperliquid
    result = await testEndpoint('/ticker/ETH?exchange=hyperliquid', 'GET', 'hyperliquid');
    printResult(result);
    results.push(result);

    // Orderbook - Aster
    result = await testEndpoint('/orderbook/ETHUSDT?exchange=aster&depth=10', 'GET', 'aster');
    printResult(result);
    results.push(result);

    // Orderbook - Hyperliquid
    result = await testEndpoint('/orderbook/ETH?exchange=hyperliquid&depth=10', 'GET', 'hyperliquid');
    printResult(result);
    results.push(result);

    // ========================================
    // AUTHENTICATED ENDPOINTS
    // ========================================
    console.log('\n🔐 AUTHENTICATED ENDPOINTS\n');

    if (!ASTER_API_KEY || !ASTER_API_SECRET) {
        console.log('⚠️  Skipping authenticated tests (no API credentials in .env)\n');
    } else {
        // Account Info
        result = await testEndpoint('/account', 'GET', 'aster', undefined, true);
        printResult(result);
        results.push(result);

        // Open Orders
        result = await testEndpoint('/orders/open', 'GET', 'aster', undefined, true);
        printResult(result);
        results.push(result);

        // Open Orders for Symbol
        result = await testEndpoint('/orders/open?symbol=ETHUSDT', 'GET', 'aster', undefined, true);
        printResult(result);
        results.push(result);

        // Order History
        result = await testEndpoint('/orders/history?limit=10', 'GET', 'aster', undefined, true);
        printResult(result);
        results.push(result);

        // Positions
        result = await testEndpoint('/positions', 'GET', 'aster', undefined, true);
        printResult(result);
        results.push(result);

        // ========================================
        // ORDER PLACEMENT TESTS
        // ========================================
        console.log('\n📝 ORDER PLACEMENT TESTS\n');

        // Test 1: Limit Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01',
            price: '2000',
            timeInForce: 'GTC'
        }, true);
        printResult(result);
        results.push(result);

        // Store order ID for cancellation test
        const limitOrderId = result.response?.data?.orderId;

        // Test 2: Market Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'BUY',
            type: 'MARKET',
            quantity: '0.01'
        }, true);
        printResult(result);
        results.push(result);

        // Test 3: Stop-Loss Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'SELL',
            type: 'STOP_MARKET',
            quantity: '0.01',
            triggerPrice: '2500',
            reduceOnly: true
        }, true);
        printResult(result);
        results.push(result);

        // Test 4: Take-Profit Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'SELL',
            type: 'TAKE_PROFIT_MARKET',
            quantity: '0.01',
            triggerPrice: '4000',
            reduceOnly: true
        }, true);
        printResult(result);
        results.push(result);

        // Test 5: Limit Order with TP/SL
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01',
            price: '2500',
            takeProfit: '3000',
            stopLoss: '2300'
        }, true);
        printResult(result);
        results.push(result);

        // Test 6: Post-Only Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01',
            price: '2000',
            postOnly: true
        }, true);
        printResult(result);
        results.push(result);

        // Test 7: IOC Order
        result = await testEndpoint('/orders', 'POST', 'aster', {
            symbol: 'ETHUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01',
            price: '3500',
            timeInForce: 'IOC'
        }, true);
        printResult(result);
        results.push(result);

        // ========================================
        // ORDER CANCELLATION TESTS
        // ========================================
        console.log('\n🗑️  ORDER CANCELLATION TESTS\n');

        // Wait a bit for orders to be placed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Cancel Single Order
        if (limitOrderId) {
            result = await testEndpoint(`/orders/${limitOrderId}?symbol=ETHUSDT`, 'DELETE', 'aster', undefined, true);
            printResult(result);
            results.push(result);
        }

        // Cancel All Orders for Symbol
        result = await testEndpoint('/orders/all?symbol=ETHUSDT', 'DELETE', 'aster', undefined, true);
        printResult(result);
        results.push(result);
    }

    // Print Summary
    printSummary();

    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
})();
