/**
 * Dual Exchange Comprehensive Test
 * Tests ALL endpoints on BOTH Aster and Hyperliquid
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  exchange: string;
  category: string;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
let userId: number;
let authToken: string;

async function apiCall(method: string, endpoint: string, body?: any, requiresAuth: boolean = false): Promise<any> {
  const headers: any = { 'Content-Type': 'application/json' };
  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options: any = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok && !data.success) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }

  return data;
}

async function runTest(exchange: string, category: string, name: string, testFn: () => Promise<any>): Promise<boolean> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ exchange, category, name, passed: true, duration });
    console.log(`✅ [${exchange}] ${name} (${duration}ms)`);
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ exchange, category, name, passed: false, duration, error: error.message });
    console.log(`❌ [${exchange}] ${name} - ${error.message}`);
    return false;
  }
}

async function testExchange(exchange: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔷 TESTING ${exchange.toUpperCase()} EXCHANGE`);
  console.log('='.repeat(70));

  const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';
  
  // Switch to this exchange
  await apiCall('POST', '/auth/session/switch', { exchange }, true);
  console.log(`📋 Switched to ${exchange}\n`);

  // Get current price
  const ticker = await apiCall('GET', `/ticker/${symbol}?exchange=${exchange}`);
  const currentPrice = parseFloat(ticker.data.price);
  const limitBuyPrice = (Math.floor(currentPrice * 0.95 * 10) / 10).toFixed(1);
  
  console.log(`📊 Current ${symbol} Price: $${currentPrice}\n`);

  // Account Tests
  console.log('--- Account & Positions ---');
  await runTest(exchange, 'Account', 'GET /account', async () => {
    const data = await apiCall('GET', '/account', null, true);
    if (!data.success) throw new Error('Failed to get account');
  });

  await runTest(exchange, 'Account', 'GET /positions', async () => {
    const data = await apiCall('GET', '/positions', null, true);
    if (!data.success) throw new Error('Failed to get positions');
  });

  // Order Placement Tests
  console.log('\n--- Order Placement ---');
  let testOrderId: string;

  // Use exchange-specific quantities (Hyperliquid needs $10 minimum)
  const quantity = exchange === 'hyperliquid' ? '0.004' : '0.002';

  await runTest(exchange, 'Orders', 'POST /order - LIMIT', async () => {
    const data = await apiCall('POST', '/order', {
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity,
      price: limitBuyPrice,
      exchange
    }, true);
    if (!data.success) throw new Error(data.error || 'Failed');
    testOrderId = data.data.orderId;
  });

  await runTest(exchange, 'Orders', 'POST /order - MARKET', async () => {
    const data = await apiCall('POST', '/order', {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity,
      exchange
    }, true);
    if (!data.success) throw new Error(data.error || 'Failed');
  });

  await runTest(exchange, 'Orders', 'POST /order - STOP_MARKET', async () => {
    const data = await apiCall('POST', '/order', {
      symbol,
      side: 'SELL',
      type: 'STOP_MARKET',
      quantity,
      triggerPrice: (Math.floor(currentPrice * 0.90 * 10) / 10).toFixed(1),
      exchange
    }, true);
    if (!data.success) throw new Error(data.error || 'Failed');
  });

  // Order Management Tests
  console.log('\n--- Order Management ---');
  await runTest(exchange, 'Orders', 'GET /orders', async () => {
    const data = await apiCall('GET', '/orders', null, true);
    if (!data.success) throw new Error('Failed');
  });

  await runTest(exchange, 'Orders', 'GET /orders/history', async () => {
    const data = await apiCall('GET', '/orders/history?limit=10', null, true);
    if (!data.success) throw new Error('Failed');
  });

  if (testOrderId) {
    await runTest(exchange, 'Orders', 'DELETE /order/:id', async () => {
      const data = await apiCall('DELETE', `/order/${testOrderId}?symbol=${symbol}`, null, true);
      if (!data.success) throw new Error('Failed');
    });
  }

  // Leverage & Margin Tests
  console.log('\n--- Leverage & Margin ---');
  await runTest(exchange, 'Leverage', 'POST /account/leverage', async () => {
    const data = await apiCall('POST', '/account/leverage', {
      symbol,
      leverage: 10,
      exchange
    }, true);
    if (!data.success) throw new Error('Failed');
  });

  await runTest(exchange, 'Leverage', 'POST /account/margin-mode', async () => {
    const data = await apiCall('POST', '/account/margin-mode', {
      symbol,
      mode: 'ISOLATED',
      exchange
    }, true);
    if (!data.success) {
      if (data.message && data.message.includes('No need to change')) {
        return; // Already in mode, OK
      }
      throw new Error(data.message || 'Failed');
    }
  });
}

async function runDualExchangeTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 DUAL EXCHANGE COMPREHENSIVE TEST');
  console.log('='.repeat(70));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}\n`);

  // Setup
  console.log('--- Setup ---');
  const userRes = await apiCall('POST', '/user', {
    telegramId: Math.floor(Math.random() * 1000000),
    username: 'dual_exchange_test'
  });
  userId = userRes.data.id;
  console.log(`✅ Created user: ${userId}`);

  await apiCall('POST', '/user/credentials', {
    userId,
    exchange: 'aster',
    apiKey: process.env.ASTER_API_KEY,
    apiSecret: process.env.ASTER_API_SECRET
  });
  console.log('✅ Linked Aster');

  await apiCall('POST', '/user/credentials', {
    userId,
    exchange: 'hyperliquid',
    address: process.env.HYPERLIQUID_ADDRESS,
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY
  });
  console.log('✅ Linked Hyperliquid');

  const sessionRes = await apiCall('POST', '/auth/session', { userId });
  authToken = sessionRes.token;
  console.log(`✅ Created unified session`);

  // Test both exchanges
  await testExchange('aster');
  await testExchange('hyperliquid');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 DUAL EXCHANGE TEST SUMMARY');
  console.log('='.repeat(70));

  const asterResults = results.filter(r => r.exchange === 'aster');
  const hyperResults = results.filter(r => r.exchange === 'hyperliquid');

  console.log(`\n🔷 ASTER:`);
  console.log(`  Passed: ${asterResults.filter(r => r.passed).length}/${asterResults.length}`);
  console.log(`  Failed: ${asterResults.filter(r => !r.passed).length}`);

  console.log(`\n🔷 HYPERLIQUID:`);
  console.log(`  Passed: ${hyperResults.filter(r => r.passed).length}/${hyperResults.length}`);
  console.log(`  Failed: ${hyperResults.filter(r => !r.passed).length}`);

  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;

  console.log(`\n🎯 OVERALL:`);
  console.log(`  Total: ${totalTests}`);
  console.log(`  Passed: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
  console.log(`  Failed: ${totalTests - totalPassed}`);

  // Save report
  await Bun.write('./dual-exchange-report.json', JSON.stringify({
    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalTests - totalPassed,
      percentage: ((totalPassed/totalTests)*100).toFixed(1)
    },
    aster: asterResults,
    hyperliquid: hyperResults
  }, null, 2));

  console.log(`\n📄 Report saved to: dual-exchange-report.json`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED ON BOTH EXCHANGES!');
  } else {
    console.log('\n⚠️  Some tests failed. Review above.');
    process.exit(1);
  }
}

runDualExchangeTest().catch(console.error);
