/**
 * Comprehensive Universal API Test Suite
 * Tests all 25+ endpoints with robust validation
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];
let userId: number;
let authToken: string;
let testOrderId: string;

// Test configuration
const TEST_SYMBOL_ASTER = 'ETHUSDT';
const TEST_SYMBOL_HYPERLIQUID = 'ETH';

function log(message: string, level: 'info' | 'success' | 'error' | 'section' = 'info') {
  const icons = { info: '📋', success: '✅', error: '❌', section: '🔷' };
  console.log(`${icons[level]} ${message}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔷 ${title}`);
  console.log('='.repeat(70));
}

async function runTest(
  category: string,
  name: string,
  testFn: () => Promise<any>
): Promise<boolean> {
  const startTime = Date.now();
  try {
    const response = await testFn();
    const duration = Date.now() - startTime;
    results.push({ category, name, passed: true, duration, response });
    log(`${name} (${duration}ms)`, 'success');
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ category, name, passed: false, duration, error: error.message });
    log(`${name} - ${error.message}`, 'error');
    return false;
  }
}

// ============ TEST HELPERS ============

async function apiCall(
  method: string,
  endpoint: string,
  body?: any,
  requiresAuth: boolean = false
): Promise<any> {
  const headers: any = { 'Content-Type': 'application/json' };
  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options: any = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok && !data.success) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// ============ TEST SUITES ============

async function testHealthCheck() {
  logSection('1. Health Check');
  
  await runTest('Health', 'GET /health', async () => {
    const data = await apiCall('GET', '/health');
    if (!data.status || !data.timestamp) {
      throw new Error('Invalid health response');
    }
    return data;
  });
}

async function testUserManagement() {
  logSection('2. User Management');

  await runTest('User', 'POST /user - Create User', async () => {
    const data = await apiCall('POST', '/user', {
      telegramId: Math.floor(Math.random() * 1000000),
      username: 'api_test_user'
    });
    
    if (!data.success || !data.data.id) {
      throw new Error('Failed to create user');
    }
    
    userId = data.data.id;
    log(`   User ID: ${userId}`, 'info');
    return data;
  });

  await runTest('User', 'POST /user/credentials - Link Aster', async () => {
    const data = await apiCall('POST', '/user/credentials', {
      userId,
      exchange: 'aster',
      apiKey: process.env.ASTER_API_KEY,
      apiSecret: process.env.ASTER_API_SECRET
    });
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to link Aster');
    }
    return data;
  });

  await runTest('User', 'POST /user/credentials - Link Hyperliquid', async () => {
    const data = await apiCall('POST', '/user/credentials', {
      userId,
      exchange: 'hyperliquid',
      address: process.env.HYPERLIQUID_ADDRESS,
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY
    });
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to link Hyperliquid');
    }
    return data;
  });

  await runTest('User', 'GET /user/exchanges - Get Linked Exchanges', async () => {
    const data = await apiCall('GET', `/user/exchanges?userId=${userId}`);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid response');
    }
    
    if (!data.data.includes('aster') || !data.data.includes('hyperliquid')) {
      throw new Error(`Expected both exchanges, got: ${data.data.join(', ')}`);
    }
    
    log(`   Linked: ${data.data.join(', ')}`, 'info');
    return data;
  });
}

async function testAuthentication() {
  logSection('3. Authentication (Unified Session)');

  await runTest('Auth', 'POST /auth/session - Create Unified Session', async () => {
    const data = await apiCall('POST', '/auth/session', { userId });
    
    if (!data.success || !data.token || !data.activeExchange || !data.linkedExchanges) {
      throw new Error('Invalid session response');
    }
    
    authToken = data.token;
    log(`   Token: ${authToken.substring(0, 30)}...`, 'info');
    log(`   Active Exchange: ${data.activeExchange}`, 'info');
    log(`   Linked Exchanges: ${data.linkedExchanges.join(', ')}`, 'info');
    return data;
  });

  await runTest('Auth', 'GET /auth/session/info - Get Session Info', async () => {
    const data = await apiCall('GET', '/auth/session/info', null, true);
    
    if (!data.success || !data.data.userId || !data.data.activeExchange) {
      throw new Error('Invalid session info');
    }
    
    log(`   User ID: ${data.data.userId}`, 'info');
    log(`   Active: ${data.data.activeExchange}`, 'info');
    return data;
  });

  await runTest('Auth', 'POST /auth/session/switch - Switch to Hyperliquid', async () => {
    const data = await apiCall('POST', '/auth/session/switch', 
      { exchange: 'hyperliquid' }, true);
    
    if (!data.success || data.activeExchange !== 'hyperliquid') {
      throw new Error('Failed to switch exchange');
    }
    
    log(`   Switched to: ${data.activeExchange}`, 'info');
    return data;
  });

  await runTest('Auth', 'POST /auth/session/switch - Switch to Aster', async () => {
    const data = await apiCall('POST', '/auth/session/switch', 
      { exchange: 'aster' }, true);
    
    if (!data.success || data.activeExchange !== 'aster') {
      throw new Error('Failed to switch exchange');
    }
    
    log(`   Switched to: ${data.activeExchange}`, 'info');
    return data;
  });
}

async function testAccountAndPositions() {
  logSection('4. Account & Positions');

  await runTest('Account', 'GET /account - Get Account Info (Aster)', async () => {
    const data = await apiCall('GET', '/account', null, true);
    
    if (!data.success || !data.data) {
      throw new Error('Invalid account response');
    }
    
    log(`   Balance: ${data.data.totalBalance} USDT`, 'info');
    return data;
  });

  await runTest('Account', 'GET /account?exchange=hyperliquid - Get Account Info (Hyperliquid)', async () => {
    const data = await apiCall('GET', '/account?exchange=hyperliquid', null, true);
    
    if (!data.success || !data.data) {
      throw new Error('Invalid account response');
    }
    
    log(`   Balance: ${data.data.totalBalance} USDT`, 'info');
    return data;
  });

  await runTest('Account', 'GET /positions - Get Positions', async () => {
    const data = await apiCall('GET', '/positions', null, true);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid positions response');
    }
    
    log(`   Open Positions: ${data.data.length}`, 'info');
    return data;
  });
}

async function testMarketData() {
  logSection('5. Market Data (Public)');

  await runTest('Market', 'GET /assets?exchange=aster - Get All Assets', async () => {
    const data = await apiCall('GET', '/assets?exchange=aster');
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid assets response');
    }
    
    log(`   Assets: ${data.data.length}`, 'info');
    return data;
  });

  await runTest('Market', 'GET /assets/search?q=ETH - Search Assets', async () => {
    const data = await apiCall('GET', '/assets/search?q=ETH');
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid search response');
    }
    
    log(`   Found: ${data.count} assets`, 'info');
    return data;
  });

  await runTest('Market', `GET /ticker/${TEST_SYMBOL_ASTER} - Get Ticker`, async () => {
    const data = await apiCall('GET', `/ticker/${TEST_SYMBOL_ASTER}?exchange=aster`);
    
    if (!data.success || !data.data.price) {
      throw new Error('Invalid ticker response');
    }
    
    log(`   Price: $${data.data.price}`, 'info');
    return data;
  });

  await runTest('Market', `GET /orderbook/${TEST_SYMBOL_ASTER} - Get Orderbook`, async () => {
    const data = await apiCall('GET', `/orderbook/${TEST_SYMBOL_ASTER}?exchange=aster&depth=10`);
    
    if (!data.success || !data.data.bids || !data.data.asks) {
      throw new Error('Invalid orderbook response');
    }
    
    log(`   Bids: ${data.data.bids.length}, Asks: ${data.data.asks.length}`, 'info');
    return data;
  });

  await runTest('Market', `GET /ohlcv/${TEST_SYMBOL_ASTER} - Get OHLCV`, async () => {
    const data = await apiCall('GET', `/ohlcv/${TEST_SYMBOL_ASTER}?exchange=aster&tf=1h&limit=10`);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid OHLCV response');
    }
    
    log(`   Candles: ${data.data.length}`, 'info');
    return data;
  });
}

async function testOrderPlacement() {
  logSection('6. Order Placement (All Types)');

  // Get current price for limit orders
  const ticker = await apiCall('GET', `/ticker/${TEST_SYMBOL_ASTER}?exchange=aster`);
  const currentPrice = parseFloat(ticker.data.price);
  // Round to tick size 0.1 for ETHUSDT on Aster
  const limitBuyPrice = (Math.floor(currentPrice * 0.95 * 10) / 10).toFixed(1);
  const limitSellPrice = (Math.ceil(currentPrice * 1.05 * 10) / 10).toFixed(1);

  await runTest('Orders', 'POST /order - LIMIT Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol: TEST_SYMBOL_ASTER,
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.002',  // Increased to meet $5 minimum notional
      price: limitBuyPrice,
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place LIMIT order');
    }
    
    if (!data.data || !data.data.orderId) {
      throw new Error('No orderId in response');
    }
    
    testOrderId = data.data.orderId;
    log(`   Order ID: ${testOrderId}`, 'info');
    return data;
  });

  await runTest('Orders', 'POST /order - MARKET Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol: TEST_SYMBOL_ASTER,
      side: 'BUY',
      type: 'MARKET',
      quantity: '0.002',  // Increased to meet $5 minimum notional
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place MARKET order');
    }
    
    return data;
  });

  await runTest('Orders', 'POST /order - STOP_MARKET Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol: TEST_SYMBOL_ASTER,
      side: 'SELL',
      type: 'STOP_MARKET',
      quantity: '0.002',  // Increased to meet $5 minimum notional
      triggerPrice: (currentPrice * 0.90).toFixed(2),
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place STOP_MARKET order');
    }
    
    return data;
  });

  await runTest('Orders', 'POST /order - STOP_LIMIT Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol: TEST_SYMBOL_ASTER,
      side: 'SELL',
      type: 'STOP_LIMIT',
      quantity: '0.002',  // Increased to meet $5 minimum notional
      triggerPrice: (Math.floor(currentPrice * 0.90 * 10) / 10).toFixed(1),
      price: (Math.floor(currentPrice * 0.89 * 10) / 10).toFixed(1),
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place STOP_LIMIT order');
    }
    
    return data;
  });

  await runTest('Orders', 'POST /order - TAKE_PROFIT_MARKET Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol: TEST_SYMBOL_ASTER,
      side: 'SELL',
      type: 'TAKE_PROFIT_MARKET',
      quantity: '0.002',  // Increased to meet $5 minimum notional
      triggerPrice: (currentPrice * 1.10).toFixed(2),
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to place TAKE_PROFIT_MARKET order');
    }
    
    return data;
  });
}

async function testOrderManagement() {
  logSection('7. Order Management');

  await runTest('Orders', 'GET /orders - Get Open Orders', async () => {
    const data = await apiCall('GET', '/orders', null, true);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid orders response');
    }
    
    log(`   Open Orders: ${data.data.length}`, 'info');
    return data;
  });

  await runTest('Orders', 'GET /orders/history - Get Order History', async () => {
    const data = await apiCall('GET', '/orders/history?limit=10', null, true);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid order history response');
    }
    
    log(`   Historical Orders: ${data.data.length}`, 'info');
    return data;
  });

  await runTest('Orders', 'GET /fills - Get Fills', async () => {
    const data = await apiCall('GET', '/fills?limit=10', null, true);
    
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid fills response');
    }
    
    log(`   Fills: ${data.data.length}`, 'info');
    return data;
  });

  if (testOrderId) {
    await runTest('Orders', `DELETE /order/${testOrderId} - Cancel Order`, async () => {
      const data = await apiCall('DELETE', `/order/${testOrderId}?symbol=${TEST_SYMBOL_ASTER}`, null, true);
      
      if (!data.success) {
        throw new Error('Failed to cancel order');
      }
      
      return data;
    });
  }

  await runTest('Orders', 'DELETE /orders - Cancel All Orders', async () => {
    const data = await apiCall('DELETE', `/orders?symbol=${TEST_SYMBOL_ASTER}`, null, true);
    
    if (!data.success) {
      throw new Error('Failed to cancel all orders');
    }
    
    return data;
  });
}

async function testLeverageAndMargin() {
  logSection('8. Leverage & Margin Management');

  await runTest('Leverage', 'POST /account/leverage - Set Leverage', async () => {
    const data = await apiCall('POST', '/account/leverage', {
      symbol: TEST_SYMBOL_ASTER,
      leverage: 10,
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      throw new Error('Failed to set leverage');
    }
    
    return data;
  });

  await runTest('Leverage', 'POST /account/margin-mode - Set Margin Mode', async () => {
    const data = await apiCall('POST', '/account/margin-mode', {
      symbol: TEST_SYMBOL_ASTER,
      mode: 'ISOLATED',
      exchange: 'aster'
    }, true);
    
    if (!data.success) {
      // If error is about already being in this mode, consider it success
      if (data.message && (data.message.includes('No need to change') || data.message.includes('already'))) {
        log('   (Already in ISOLATED mode)', 'info');
        return { success: true, note: 'Already in target mode' };
      }
      throw new Error(data.message || data.error || 'Failed to set margin mode');
    }
    
    return data;
  });
}

async function testPositionManagement() {
  logSection('9. Position Management');

  await runTest('Position', 'POST /position/tp-sl - Set TP/SL', async () => {
    try {
      const data = await apiCall('POST', '/position/tp-sl', {
        symbol: TEST_SYMBOL_ASTER,
        tp: '5000',
        sl: '2000',
        exchange: 'aster'
      }, true);
      return data;
    } catch (error: any) {
      // It's okay if there's no position
      if (error.message.includes('No position')) {
        log('   (No open position - expected)', 'info');
        return { success: true, note: 'No position to set TP/SL' };
      }
      throw error;
    }
  });
}

async function testExchangeSwitching() {
  logSection('10. Exchange Switching Tests');

  await runTest('Switching', 'Switch to Hyperliquid and Get Account', async () => {
    // Switch to Hyperliquid
    await apiCall('POST', '/auth/session/switch', { exchange: 'hyperliquid' }, true);
    
    // Get account info (should be Hyperliquid)
    const data = await apiCall('GET', '/account', null, true);
    
    if (!data.success) {
      throw new Error('Failed to get Hyperliquid account');
    }
    
    log(`   Hyperliquid Balance: ${data.data.totalBalance}`, 'info');
    return data;
  });

  await runTest('Switching', 'Switch to Aster and Get Account', async () => {
    // Switch to Aster
    await apiCall('POST', '/auth/session/switch', { exchange: 'aster' }, true);
    
    // Get account info (should be Aster)
    const data = await apiCall('GET', '/account', null, true);
    
    if (!data.success) {
      throw new Error('Failed to get Aster account');
    }
    
    log(`   Aster Balance: ${data.data.totalBalance}`, 'info');
    return data;
  });
}

async function testSessionCleanup() {
  logSection('11. Session Cleanup');

  await runTest('Auth', 'DELETE /auth/session - Logout', async () => {
    const data = await apiCall('DELETE', '/auth/session', null, true);
    
    if (!data.success) {
      throw new Error('Failed to delete session');
    }
    
    return data;
  });
}

// ============ MAIN TEST RUNNER ============

async function runAllTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 COMPREHENSIVE UNIVERSAL API TEST SUITE');
  console.log('='.repeat(70));
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}\n`);

  const startTime = Date.now();

  try {
    await testHealthCheck();
    await testUserManagement();
    await testAuthentication();
    await testAccountAndPositions();
    await testMarketData();
    await testOrderPlacement();
    await testOrderManagement();
    await testLeverageAndMargin();
    await testPositionManagement();
    await testExchangeSwitching();
    await testSessionCleanup();
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
  }

  const totalDuration = Date.now() - startTime;

  // Generate Summary Report
  logSection('TEST SUMMARY REPORT');
  
  const categories = [...new Set(results.map(r => r.category))];
  
  categories.forEach(category => {
    const categoryTests = results.filter(r => r.category === category);
    const passed = categoryTests.filter(r => r.passed).length;
    const total = categoryTests.length;
    const percentage = ((passed / total) * 100).toFixed(1);
    
    console.log(`\n${category}:`);
    console.log(`  Passed: ${passed}/${total} (${percentage}%)`);
    
    categoryTests.forEach(test => {
      const icon = test.passed ? '✅' : '❌';
      console.log(`  ${icon} ${test.name} (${test.duration}ms)`);
      if (!test.passed && test.error) {
        console.log(`     Error: ${test.error}`);
      }
    });
  });

  // Overall Summary
  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('📊 OVERALL RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed} (${overallPercentage}%)`);
  console.log(`Failed: ${totalTests - totalPassed}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Average Test Duration: ${(totalDuration / totalTests).toFixed(0)}ms`);

  // Save detailed results to file
  const reportPath = './api-test-report.json';
  await Bun.write(reportPath, JSON.stringify({
    summary: {
      totalTests,
      passed: totalPassed,
      failed: totalTests - totalPassed,
      percentage: overallPercentage,
      duration: totalDuration,
      timestamp: new Date().toISOString()
    },
    results,
    categories: categories.map(cat => ({
      name: cat,
      tests: results.filter(r => r.category === cat)
    }))
  }, null, 2));

  console.log(`\n📄 Detailed results saved to: ${reportPath}`);

  if (totalPassed === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! API is fully functional.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the errors above.');
    process.exit(1);
  }
}

// Run the test suite
runAllTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
