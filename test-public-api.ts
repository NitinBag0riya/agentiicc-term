#!/usr/bin/env bun
/**
 * Comprehensive Universal API Testing on Public URL
 * Tests all routes: health, auth, market data, account, orders, positions
 */

const PUBLIC_URL = 'https://97877c2a1fef.ngrok-free.app';
const TEST_USER_ID = 2;

interface TestResult {
  route: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
  responseTime?: number;
  details?: any;
}

const results: TestResult[] = [];

async function testRoute(
  route: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const url = route.startsWith('http') ? route : `${PUBLIC_URL}${route}`;
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    const result: TestResult = {
      route,
      method,
      status: response.ok ? 'PASS' : 'FAIL',
      statusCode: response.status,
      responseTime,
      details: data
    };
    
    if (!response.ok) {
      result.error = typeof data === 'string' ? data : JSON.stringify(data);
    }
    
    return result;
  } catch (error: any) {
    return {
      route,
      method,
      status: 'FAIL',
      error: error.message,
      responseTime: Date.now() - startTime
    };
  }
}

async function createTestSession(): Promise<string | null> {
  console.log('\n📝 Creating test session...');
  
  const result = await testRoute('/auth/session', 'POST', {
    userId: TEST_USER_ID,
    exchangeId: 'aster'
  });
  
  results.push(result);
  
  if (result.status === 'PASS' && result.details?.token) {
    console.log(`✅ Session created: ${result.details.token}`);
    return result.details.token;
  } else {
    console.log(`❌ Failed to create session: ${result.error || JSON.stringify(result.details)}`);
    return null;
  }
}

async function testPublicRoutes() {
  console.log('\n' + '='.repeat(80));
  console.log('🌐 TESTING PUBLIC ROUTES (No Auth Required)');
  console.log('='.repeat(80));
  
  // Health check
  console.log('\n1️⃣ Health Check');
  const health = await testRoute('/health');
  results.push(health);
  console.log(`   ${health.status === 'PASS' ? '✅' : '❌'} GET /health - ${health.statusCode} (${health.responseTime}ms)`);
  if (health.details) console.log(`   Response: ${JSON.stringify(health.details)}`);
  
  // Assets - Aster
  console.log('\n2️⃣ Assets - Aster');
  const asterAssets = await testRoute('/assets?exchange=aster');
  results.push(asterAssets);
  console.log(`   ${asterAssets.status === 'PASS' ? '✅' : '❌'} GET /assets?exchange=aster - ${asterAssets.statusCode} (${asterAssets.responseTime}ms)`);
  if (asterAssets.status === 'PASS') {
    console.log(`   Found ${asterAssets.details?.length || 0} assets`);
  } else {
    console.log(`   Error: ${asterAssets.error}`);
  }
  
  // Assets - Hyperliquid
  console.log('\n3️⃣ Assets - Hyperliquid');
  const hlAssets = await testRoute('/assets?exchange=hyperliquid');
  results.push(hlAssets);
  console.log(`   ${hlAssets.status === 'PASS' ? '✅' : '❌'} GET /assets?exchange=hyperliquid - ${hlAssets.statusCode} (${hlAssets.responseTime}ms)`);
  if (hlAssets.status === 'PASS') {
    console.log(`   Found ${hlAssets.details?.length || 0} assets`);
  } else {
    console.log(`   Error: ${hlAssets.error}`);
  }
  
  // Search
  console.log('\n4️⃣ Search');
  const search = await testRoute('/assets/search?q=BTC');
  results.push(search);
  console.log(`   ${search.status === 'PASS' ? '✅' : '❌'} GET /assets/search?q=BTC - ${search.statusCode} (${search.responseTime}ms)`);
  if (search.status === 'PASS') {
    console.log(`   Found ${search.details?.data?.length || search.details?.count || 0} results`);
  } else {
    console.log(`   Error: ${search.error}`);
  }
  
  // Ticker - Aster
  console.log('\n5️⃣ Ticker - Aster BTC');
  const asterTicker = await testRoute('/ticker/BTCUSDT?exchange=aster');
  results.push(asterTicker);
  console.log(`   ${asterTicker.status === 'PASS' ? '✅' : '❌'} GET /ticker/BTCUSDT?exchange=aster - ${asterTicker.statusCode} (${asterTicker.responseTime}ms)`);
  if (asterTicker.status === 'PASS') {
    const price = asterTicker.details?.data?.price || asterTicker.details?.data?.lastPrice || asterTicker.details?.price || 'N/A';
    console.log(`   Price: $${price}`);
  } else {
    console.log(`   Error: ${asterTicker.error}`);
  }
  
  // Ticker - Hyperliquid
  console.log('\n6️⃣ Ticker - Hyperliquid BTC');
  const hlTicker = await testRoute('/ticker/BTC?exchange=hyperliquid');
  results.push(hlTicker);
  console.log(`   ${hlTicker.status === 'PASS' ? '✅' : '❌'} GET /ticker/BTC?exchange=hyperliquid - ${hlTicker.statusCode} (${hlTicker.responseTime}ms)`);
  if (hlTicker.status === 'PASS') {
    const price = hlTicker.details?.data?.price || hlTicker.details?.data?.lastPrice || hlTicker.details?.price || 'N/A';
    console.log(`   Price: $${price}`);
  } else {
    console.log(`   Error: ${hlTicker.error}`);
  }
  
  // Orderbook - Aster
  console.log('\n7️⃣ Orderbook - Aster');
  const asterOrderbook = await testRoute('/orderbook/BTCUSDT?exchange=aster&depth=5');
  results.push(asterOrderbook);
  console.log(`   ${asterOrderbook.status === 'PASS' ? '✅' : '❌'} GET /orderbook/BTCUSDT?exchange=aster&depth=5 - ${asterOrderbook.statusCode} (${asterOrderbook.responseTime}ms)`);
  if (asterOrderbook.status === 'PASS') {
    const data = asterOrderbook.details?.data || asterOrderbook.details;
    console.log(`   Bids: ${data?.bids?.length || 0}, Asks: ${data?.asks?.length || 0}`);
  } else {
    console.log(`   Error: ${asterOrderbook.error}`);
  }
  
  // Orderbook - Hyperliquid
  console.log('\n8️⃣ Orderbook - Hyperliquid');
  const hlOrderbook = await testRoute('/orderbook/BTC?exchange=hyperliquid&depth=5');
  results.push(hlOrderbook);
  console.log(`   ${hlOrderbook.status === 'PASS' ? '✅' : '❌'} GET /orderbook/BTC?exchange=hyperliquid&depth=5 - ${hlOrderbook.statusCode} (${hlOrderbook.responseTime}ms)`);
  if (hlOrderbook.status === 'PASS') {
    const data = hlOrderbook.details?.data || hlOrderbook.details;
    console.log(`   Bids: ${data?.bids?.length || 0}, Asks: ${data?.asks?.length || 0}`);
  } else {
    console.log(`   Error: ${hlOrderbook.error}`);
  }
}

async function testAuthenticatedRoutes(sessionId: string) {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 TESTING AUTHENTICATED ROUTES');
  console.log('='.repeat(80));
  
  const authHeaders = {
    'Authorization': `Bearer ${sessionId}`,
    'Cookie': `session=${sessionId}`
  };
  
  // Account Info - Aster
  console.log('\n9️⃣ Account Info - Aster');
  const asterAccount = await testRoute('/account?exchange=aster', 'GET', undefined, authHeaders);
  results.push(asterAccount);
  console.log(`   ${asterAccount.status === 'PASS' ? '✅' : '❌'} GET /account?exchange=aster - ${asterAccount.statusCode} (${asterAccount.responseTime}ms)`);
  if (asterAccount.status === 'PASS') {
    console.log(`   Balance: $${asterAccount.details?.totalBalance || 'N/A'}`);
    console.log(`   Positions: ${asterAccount.details?.positions?.length || 0}`);
  } else {
    console.log(`   Error: ${asterAccount.error}`);
  }
  
  // Account Info - Hyperliquid
  console.log('\n🔟 Account Info - Hyperliquid');
  const hlAccount = await testRoute('/account?exchange=hyperliquid', 'GET', undefined, authHeaders);
  results.push(hlAccount);
  console.log(`   ${hlAccount.status === 'PASS' ? '✅' : '❌'} GET /account?exchange=hyperliquid - ${hlAccount.statusCode} (${hlAccount.responseTime}ms)`);
  if (hlAccount.status === 'PASS') {
    console.log(`   Balance: $${hlAccount.details?.totalBalance || 'N/A'}`);
    console.log(`   Positions: ${hlAccount.details?.positions?.length || 0}`);
  } else {
    console.log(`   Error: ${hlAccount.error}`);
  }
  
  // Open Orders - Aster
  console.log('\n1️⃣1️⃣ Open Orders - Aster');
  const asterOrders = await testRoute('/orders?exchange=aster', 'GET', undefined, authHeaders);
  results.push(asterOrders);
  console.log(`   ${asterOrders.status === 'PASS' ? '✅' : '❌'} GET /orders?exchange=aster - ${asterOrders.statusCode} (${asterOrders.responseTime}ms)`);
  if (asterOrders.status === 'PASS') {
    console.log(`   Open orders: ${asterOrders.details?.length || 0}`);
  } else {
    console.log(`   Error: ${asterOrders.error}`);
  }
  
  // Open Orders - Hyperliquid
  console.log('\n1️⃣2️⃣ Open Orders - Hyperliquid');
  const hlOrders = await testRoute('/orders?exchange=hyperliquid', 'GET', undefined, authHeaders);
  results.push(hlOrders);
  console.log(`   ${hlOrders.status === 'PASS' ? '✅' : '❌'} GET /orders?exchange=hyperliquid - ${hlOrders.statusCode} (${hlOrders.responseTime}ms)`);
  if (hlOrders.status === 'PASS') {
    console.log(`   Open orders: ${hlOrders.details?.length || 0}`);
  } else {
    console.log(`   Error: ${hlOrders.error}`);
  }
  
  // Positions - Aster
  console.log('\n1️⃣3️⃣ Positions - Aster');
  const asterPositions = await testRoute('/positions?exchange=aster', 'GET', undefined, authHeaders);
  results.push(asterPositions);
  console.log(`   ${asterPositions.status === 'PASS' ? '✅' : '❌'} GET /positions?exchange=aster - ${asterPositions.statusCode} (${asterPositions.responseTime}ms)`);
  if (asterPositions.status === 'PASS') {
    console.log(`   Open positions: ${asterPositions.details?.length || 0}`);
  } else {
    console.log(`   Error: ${asterPositions.error}`);
  }
  
  // Positions - Hyperliquid
  console.log('\n1️⃣4️⃣ Positions - Hyperliquid');
  const hlPositions = await testRoute('/positions?exchange=hyperliquid', 'GET', undefined, authHeaders);
  results.push(hlPositions);
  console.log(`   ${hlPositions.status === 'PASS' ? '✅' : '❌'} GET /positions?exchange=hyperliquid - ${hlPositions.statusCode} (${hlPositions.responseTime}ms)`);
  if (hlPositions.status === 'PASS') {
    console.log(`   Open positions: ${hlPositions.details?.length || 0}`);
  } else {
    console.log(`   Error: ${hlPositions.error}`);
  }
}

async function testOrderPlacement(sessionId: string) {
  console.log('\n' + '='.repeat(80));
  console.log('📝 TESTING ORDER PLACEMENT & CANCELLATION');
  console.log('='.repeat(80));
  
  const authHeaders = {
    'Authorization': `Bearer ${sessionId}`,
    'Cookie': `session=${sessionId}`
  };
  
  // Get current BTC price for Aster
  const tickerResult = await testRoute('/ticker/BTCUSDT?exchange=aster');
  if (tickerResult.status !== 'PASS') {
    console.log('❌ Cannot get BTC price, skipping order tests');
    return;
  }
  
  const currentPrice = parseFloat(tickerResult.details?.data?.price || tickerResult.details?.data?.lastPrice || tickerResult.details?.price || '0');
  console.log(`\n💰 Current BTC Price: $${currentPrice.toFixed(2)}`);
  
  if (currentPrice === 0) {
    console.log('❌ Cannot get valid BTC price, skipping order tests');
    return;
  }
  
  // Test 1: Limit Order - Aster
  console.log('\n1️⃣5️⃣ Place Limit Order - Aster');
  const limitPrice = (Math.floor(currentPrice * 0.80 * 10) / 10).toFixed(1); // 20% below market, 1 decimal
  const placeOrder = await testRoute('/order', 'POST', {
    exchange: 'aster',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: '0.001',
    price: limitPrice
  }, authHeaders);
  results.push(placeOrder);
  console.log(`   ${placeOrder.status === 'PASS' ? '✅' : '❌'} POST /order (Limit) - ${placeOrder.statusCode} (${placeOrder.responseTime}ms)`);
  
  if (placeOrder.status === 'PASS' && placeOrder.details?.success && placeOrder.details?.data?.orderId) {
    console.log(`   Order ID: ${placeOrder.details.data.orderId}`);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Cancel Order - Aster
    console.log('\n1️⃣6️⃣ Cancel Order - Aster');
    const cancelOrder = await testRoute(`/order/${placeOrder.details.data.orderId}?exchange=aster&symbol=BTCUSDT`, 'DELETE', undefined, authHeaders);
    results.push(cancelOrder);
    console.log(`   ${cancelOrder.status === 'PASS' ? '✅' : '❌'} DELETE /order - ${cancelOrder.statusCode} (${cancelOrder.responseTime}ms)`);
  } else {
    console.log(`   Failed: ${placeOrder.details?.error || placeOrder.error || 'Unknown error'}`);
  }
  
  // Test 3: Limit Order with TP/SL - Aster
  console.log('\n1️⃣7️⃣ Place Limit Order with TP/SL - Aster');
  const limitPrice2 = (Math.floor(currentPrice * 0.85 * 10) / 10).toFixed(1);
  const takeProfit = (Math.floor(parseFloat(limitPrice2) * 1.10 * 10) / 10).toFixed(1);
  const stopLoss = (Math.floor(parseFloat(limitPrice2) * 0.95 * 10) / 10).toFixed(1);
  
  const placeOrderTPSL = await testRoute('/order', 'POST', {
    exchange: 'aster',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: '0.001',
    price: limitPrice2,
    takeProfit,
    stopLoss
  }, authHeaders);
  results.push(placeOrderTPSL);
  console.log(`   ${placeOrderTPSL.status === 'PASS' ? '✅' : '❌'} POST /order (Limit + TP/SL) - ${placeOrderTPSL.statusCode} (${placeOrderTPSL.responseTime}ms)`);
  
  if (placeOrderTPSL.status === 'PASS' && placeOrderTPSL.details?.success && placeOrderTPSL.details?.data?.orderId) {
    console.log(`   Order ID: ${placeOrderTPSL.details.data.orderId}`);
    console.log(`   TP: $${takeProfit}, SL: $${stopLoss}`);
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Cancel
    console.log('\n1️⃣8️⃣ Cancel Order with TP/SL - Aster');
    const cancelOrderTPSL = await testRoute(`/order/${placeOrderTPSL.details.data.orderId}?exchange=aster&symbol=BTCUSDT`, 'DELETE', undefined, authHeaders);
    results.push(cancelOrderTPSL);
    console.log(`   ${cancelOrderTPSL.status === 'PASS' ? '✅' : '❌'} DELETE /order - ${cancelOrderTPSL.statusCode} (${cancelOrderTPSL.responseTime}ms)`);
  } else {
    console.log(`   Failed: ${placeOrderTPSL.details?.error || placeOrderTPSL.error || 'Unknown error'}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⚠️  Skipped: ${skipped}/${total}`);
  
  const successRate = ((passed / total) * 100).toFixed(1);
  console.log(`\n🎯 Success Rate: ${successRate}%`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    console.log('-'.repeat(80));
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`\n${r.method} ${r.route}`);
      console.log(`Status Code: ${r.statusCode || 'N/A'}`);
      console.log(`Error: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    publicUrl: PUBLIC_URL,
    summary: {
      total,
      passed,
      failed,
      skipped,
      successRate: `${successRate}%`
    },
    results
  };
  
  Bun.write('/tmp/public_api_test_report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Detailed report saved to: /tmp/public_api_test_report.json');
}

async function main() {
  console.log('🚀 Universal API Testing on Public URL');
  console.log('='.repeat(80));
  console.log(`🌐 Public URL: ${PUBLIC_URL}`);
  console.log('='.repeat(80));
  
  try {
    // Test public routes
    await testPublicRoutes();
    
    // Create session for authenticated routes
    const sessionId = await createTestSession();
    
    if (sessionId) {
      // Test authenticated routes
      await testAuthenticatedRoutes(sessionId);
      
      // Test order placement and cancellation
      await testOrderPlacement(sessionId);
    } else {
      console.log('\n⚠️  Skipping authenticated tests - no session');
    }
    
    // Print summary
    printSummary();
    
    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

main();
