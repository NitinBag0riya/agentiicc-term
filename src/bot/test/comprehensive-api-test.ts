/**
 * Comprehensive API Test - Tests ALL bot APIs with real credentials
 * Simulates what happens when users click CTAs in Telegram
 */
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_USER_ID = process.env.TEST_CHAT_ID || '7797429783';

interface TestResult {
  endpoint: string;
  method: string;
  success: boolean;
  responseTime: number;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

async function testEndpoint(
  method: string,
  endpoint: string,
  data?: any,
  headers?: any
): Promise<TestResult> {
  const startTime = Date.now();
  const fullUrl = `${API_URL}${endpoint}`;
  
  try {
    console.log(`\n🧪 Testing: ${method} ${endpoint}`);
    
    let response;
    if (method === 'GET') {
      response = await axios.get(fullUrl, { params: data, headers });
    } else {
      response = await axios.post(fullUrl, data, { headers });
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`   ✅ Success (${responseTime}ms)`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
    
    return {
      endpoint,
      method,
      success: true,
      responseTime,
      data: response.data
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ Failed (${responseTime}ms)`);
    console.log(`   Error:`, error.response?.data || error.message);
    
    return {
      endpoint,
      method,
      success: false,
      responseTime,
      error: error.response?.data?.error || error.message
    };
  }
}

async function main() {
  console.log('🚀 Comprehensive API Test - Simulating Bot CTAs');
  console.log('═'.repeat(70));
  console.log(`API URL: ${API_URL}`);
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log('═'.repeat(70));
  
  // ============ PHASE 1: AUTH & SESSION ============
  console.log('\n\n📍 PHASE 1: Authentication & Session');
  console.log('─'.repeat(70));
  
  // 1. Create session (this is what bot does first)
  const sessionResult = await testEndpoint('POST', '/auth/session', {
    userId: TEST_USER_ID
  });
  
  if (!sessionResult.success) {
    console.log('\n❌ Session creation failed - cannot proceed with authenticated tests');
    console.log('   This means the user is not properly linked.');
    console.log('   Please link your account first using the bot.');
    return;
  }
  
  const token = sessionResult.data?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  
  console.log(`\n✅ Session created successfully`);
  console.log(`   Token: ${token?.substring(0, 30)}...`);
  
  // ============ PHASE 2: ACCOUNT INFO ============
  console.log('\n\n📍 PHASE 2: Account Information (Citadel Screen)');
  console.log('─'.repeat(70));
  
  // 2. Get account info for Aster
  results.push(await testEndpoint('GET', '/account', 
    { exchange: 'aster' }, 
    authHeaders
  ));
  
  // 3. Get account info for Hyperliquid
  results.push(await testEndpoint('GET', '/account', 
    { exchange: 'hyperliquid' }, 
    authHeaders
  ));
  
  // ============ PHASE 3: POSITIONS ============
  console.log('\n\n📍 PHASE 3: Positions (Positions Screen)');
  console.log('─'.repeat(70));
  
  // 4. Get positions for Aster
  results.push(await testEndpoint('GET', '/positions', 
    { exchange: 'aster' }, 
    authHeaders
  ));
  
  // 5. Get positions for Hyperliquid
  results.push(await testEndpoint('GET', '/positions', 
    { exchange: 'hyperliquid' }, 
    authHeaders
  ));
  
  // ============ PHASE 4: ASSETS ============
  console.log('\n\n📍 PHASE 4: Assets (Assets Screen)');
  console.log('─'.repeat(70));
  
  // 6. Get assets for Aster
  results.push(await testEndpoint('GET', '/assets', 
    { exchange: 'aster' }
  ));
  
  // 7. Get assets for Hyperliquid
  results.push(await testEndpoint('GET', '/assets', 
    { exchange: 'hyperliquid' }
  ));
  
  // 8. Search assets
  results.push(await testEndpoint('GET', '/assets/search', 
    { query: 'BTC', exchange: 'aster' }
  ));
  
  // ============ PHASE 5: OPEN ORDERS ============
  console.log('\n\n📍 PHASE 5: Open Orders (Order Management)');
  console.log('─'.repeat(70));
  
  // 9. Get open orders for Aster
  results.push(await testEndpoint('GET', '/orders/open', 
    { exchange: 'aster' }, 
    authHeaders
  ));
  
  // 10. Get open orders for Hyperliquid
  results.push(await testEndpoint('GET', '/orders/open', 
    { exchange: 'hyperliquid' }, 
    authHeaders
  ));
  
  // 11. Get open orders for specific symbol
  results.push(await testEndpoint('GET', '/orders/open', 
    { exchange: 'aster', symbol: 'BTCUSDT' }, 
    authHeaders
  ));
  
  // ============ PHASE 6: ORDER HISTORY ============
  console.log('\n\n📍 PHASE 6: Order History');
  console.log('─'.repeat(70));
  
  // 12. Get order history for Aster
  results.push(await testEndpoint('GET', '/orders/history', 
    { exchange: 'aster', limit: 10 }, 
    authHeaders
  ));
  
  // 13. Get order history for Hyperliquid
  results.push(await testEndpoint('GET', '/orders/history', 
    { exchange: 'hyperliquid', limit: 10 }, 
    authHeaders
  ));
  
  // ============ PHASE 7: LEVERAGE & MARGIN ============
  console.log('\n\n📍 PHASE 7: Leverage & Margin (Settings CTAs)');
  console.log('─'.repeat(70));
  
  // 14. Set leverage (test with 5x)
  results.push(await testEndpoint('POST', '/account/leverage', 
    { symbol: 'BTCUSDT', leverage: 5, exchange: 'aster' }, 
    authHeaders
  ));
  
  // 15. Set margin mode
  results.push(await testEndpoint('POST', '/account/margin-mode', 
    { symbol: 'BTCUSDT', marginMode: 'cross', exchange: 'aster' }, 
    authHeaders
  ));
  
  // ============ PHASE 8: PLACE ORDER (DRY RUN) ============
  console.log('\n\n📍 PHASE 8: Order Placement (Trading CTAs)');
  console.log('─'.repeat(70));
  console.log('⚠️  Note: Skipping actual order placement to avoid real trades');
  console.log('   In production, these endpoints would be called when:');
  console.log('   - User clicks "Long $50" / "Short $50"');
  console.log('   - User sets TP/SL');
  console.log('   - User closes position');
  
  // Show what the order payload would look like
  console.log('\n📋 Example Order Payloads:');
  console.log('\n   Market Buy Order:');
  console.log(JSON.stringify({
    exchange: 'aster',
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.001
  }, null, 2));
  
  console.log('\n   Take Profit Order:');
  console.log(JSON.stringify({
    exchange: 'aster',
    symbol: 'BTCUSDT',
    side: 'SELL',
    type: 'TAKE_PROFIT_MARKET',
    stopPrice: 100000,
    quantity: 0.001
  }, null, 2));
  
  // ============ SUMMARY ============
  console.log('\n\n📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
  
  console.log(`Total API Calls: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log('═'.repeat(70));
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.method} ${r.endpoint}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Successful Tests:');
  results.filter(r => r.success).forEach(r => {
    console.log(`   - ${r.method} ${r.endpoint} (${r.responseTime}ms)`);
  });
  
  console.log('\n\n🎯 NEXT STEPS:');
  if (failedTests > 0) {
    console.log('   1. Check the failed endpoints above');
    console.log('   2. Review the error messages');
    console.log('   3. Fix the issues in the API server');
    console.log('   4. Re-run this test');
  } else {
    console.log('   ✅ All API endpoints are working!');
    console.log('   ✅ Bot CTAs should work correctly');
    console.log('   ✅ Ready for production use');
  }
  
  console.log('\n');
}

main().catch(console.error);
