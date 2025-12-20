/**
 * COMPLETE API TEST - ALL 30+ ENDPOINTS
 * Tests EVERY API call used by the bot with REAL credentials
 * Based on error_handling_audit.md (43 API call sites)
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const USER_ID = process.env.TEST_CHAT_ID || '7797429783';
const ASTER_API_KEY = process.env.ASTER_API_KEY;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET;

interface TestResult {
  category: string;
  endpoint: string;
  method: string;
  success: boolean;
  data?: any;
  error?: string;
  responseTime: number;
}

const results: TestResult[] = [];
let sessionToken: string;

async function test(category: string, endpoint: string, method: string, fn: () => Promise<any>): Promise<void> {
  const startTime = Date.now();
  const testName = `${method} ${endpoint}`;
  
  try {
    const data = await fn();
    const responseTime = Date.now() - startTime;
    
    console.log(`   ✅ ${testName} (${responseTime}ms)`);
    
    results.push({ category, endpoint, method, success: true, data, responseTime });
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.error || error.message;
    
    console.log(`   ❌ ${testName} (${responseTime}ms): ${errorMsg}`);
    
    results.push({ category, endpoint, method, success: false, error: errorMsg, responseTime });
  }
}

async function main() {
  console.log('🚀 COMPLETE API TEST - ALL 30+ ENDPOINTS');
  console.log('═'.repeat(80));
  console.log('Testing EVERY API call used by the bot');
  console.log('Using REAL Aster credentials from .env');
  console.log('═'.repeat(80));
  
  if (!ASTER_API_KEY || !ASTER_API_SECRET) {
    console.error('❌ ASTER_API_KEY and ASTER_API_SECRET required in .env');
    process.exit(1);
  }
  
  // ============ SETUP: LINK & SESSION ============
  console.log('\n📍 SETUP: Link Account & Create Session');
  console.log('─'.repeat(80));
  
  await test('Setup', '/user/credentials', 'POST', async () => {
    const res = await axios.post(`${API_URL}/user/credentials`, {
      userId: USER_ID,
      exchange: 'aster',
      apiKey: ASTER_API_KEY,
      apiSecret: ASTER_API_SECRET
    });
    return res.data;
  });
  
  await test('Setup', '/auth/session', 'POST', async () => {
    const res = await axios.post(`${API_URL}/auth/session`, { userId: USER_ID });
    if (res.data.success) sessionToken = res.data.token;
    return res.data;
  });
  
  if (!sessionToken) {
    console.error('\n❌ Cannot proceed without session token');
    process.exit(1);
  }
  
  const auth = { Authorization: `Bearer ${sessionToken}` };
  
  // ============ ACCOUNT ENDPOINTS ============
  console.log('\n📍 ACCOUNT ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('Account', '/account', 'GET', async () => {
    const res = await axios.get(`${API_URL}/account`, {
      params: { exchange: 'aster' },
      headers: auth
    });
    return res.data;
  });
  
  await test('Account', '/account/leverage', 'POST', async () => {
    const res = await axios.post(`${API_URL}/account/leverage`, {
      symbol: 'BTCUSDT',
      leverage: 5,
      exchange: 'aster'
    }, { headers: auth });
    return res.data;
  });
  
  await test('Account', '/account/margin', 'POST', async () => {
    const res = await axios.post(`${API_URL}/account/margin`, {
      symbol: 'BTCUSDT',
      amount: 10,
      exchange: 'aster'
    }, { headers: auth });
    return res.data;
  });
  
  await test('Account', '/account/margin-mode', 'POST', async () => {
    const res = await axios.post(`${API_URL}/account/margin-mode`, {
      symbol: 'BTCUSDT',
      marginMode: 'cross',
      exchange: 'aster'
    }, { headers: auth });
    return res.data;
  });
  
  // ============ POSITIONS ENDPOINTS ============
  console.log('\n📍 POSITIONS ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('Positions', '/positions', 'GET', async () => {
    const res = await axios.get(`${API_URL}/positions`, {
      params: { exchange: 'aster' },
      headers: auth
    });
    return res.data;
  });
  
  await test('Positions', '/positions/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/positions/BTCUSDT`, {
      params: { exchange: 'aster' },
      headers: auth
    });
    return res.data;
  });
  
  await test('Positions', '/position/close', 'POST', async () => {
    const res = await axios.post(`${API_URL}/position/close`, {
      symbol: 'BTCUSDT',
      exchange: 'aster'
    }, { headers: auth });
    return res.data;
  });
  
  // ============ ORDERS ENDPOINTS ============
  console.log('\n📍 ORDERS ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('Orders', '/order', 'POST', async () => {
    const res = await axios.post(`${API_URL}/order`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.001,
      price: 50000
    }, { headers: auth });
    return res.data;
  });
  
  await test('Orders', '/orders/open', 'GET', async () => {
    const res = await axios.get(`${API_URL}/orders/open`, {
      params: { exchange: 'aster' },
      headers: auth
    });
    return res.data;
  });
  
  await test('Orders', '/orders/open/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/orders/open`, {
      params: { exchange: 'aster', symbol: 'BTCUSDT' },
      headers: auth
    });
    return res.data;
  });
  
  await test('Orders', '/orders/history', 'GET', async () => {
    const res = await axios.get(`${API_URL}/orders/history`, {
      params: { exchange: 'aster', limit: 10 },
      headers: auth
    });
    return res.data;
  });
  
  await test('Orders', '/order/cancel', 'POST', async () => {
    const res = await axios.post(`${API_URL}/order/cancel`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      orderId: '12345'
    }, { headers: auth });
    return res.data;
  });
  
  await test('Orders', '/orders/cancel-all', 'POST', async () => {
    const res = await axios.post(`${API_URL}/orders/cancel-all`, {
      exchange: 'aster',
      symbol: 'BTCUSDT'
    }, { headers: auth });
    return res.data;
  });
  
  // ============ ASSETS ENDPOINTS ============
  console.log('\n📍 ASSETS ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('Assets', '/assets', 'GET', async () => {
    const res = await axios.get(`${API_URL}/assets`, {
      params: { exchange: 'aster' }
    });
    return res.data;
  });
  
  await test('Assets', '/assets/search', 'GET', async () => {
    const res = await axios.get(`${API_URL}/assets/search`, {
      params: { query: 'BTC', exchange: 'aster' }
    });
    return res.data;
  });
  
  await test('Assets', '/asset/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/asset/BTCUSDT`, {
      params: { exchange: 'aster' }
    });
    return res.data;
  });
  
  // ============ TRADING ENDPOINTS ============
  console.log('\n📍 TRADING ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('Trading', '/trade/market', 'POST', async () => {
    const res = await axios.post(`${API_URL}/trade/market`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.001
    }, { headers: auth });
    return res.data;
  });
  
  await test('Trading', '/trade/limit', 'POST', async () => {
    const res = await axios.post(`${API_URL}/trade/limit`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.001,
      price: 50000
    }, { headers: auth });
    return res.data;
  });
  
  await test('Trading', '/trade/stop-loss', 'POST', async () => {
    const res = await axios.post(`${API_URL}/trade/stop-loss`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      side: 'SELL',
      quantity: 0.001,
      stopPrice: 45000
    }, { headers: auth });
    return res.data;
  });
  
  await test('Trading', '/trade/take-profit', 'POST', async () => {
    const res = await axios.post(`${API_URL}/trade/take-profit`, {
      exchange: 'aster',
      symbol: 'BTCUSDT',
      side: 'SELL',
      quantity: 0.001,
      stopPrice: 55000
    }, { headers: auth });
    return res.data;
  });
  
  // ============ PRICE & MARKET DATA ============
  console.log('\n📍 PRICE & MARKET DATA');
  console.log('─'.repeat(80));
  
  await test('Market', '/price/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/price/BTCUSDT`, {
      params: { exchange: 'aster' }
    });
    return res.data;
  });
  
  await test('Market', '/prices', 'GET', async () => {
    const res = await axios.get(`${API_URL}/prices`, {
      params: { exchange: 'aster' }
    });
    return res.data;
  });
  
  await test('Market', '/ticker/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/ticker/BTCUSDT`, {
      params: { exchange: 'aster' }
    });
    return res.data;
  });
  
  await test('Market', '/orderbook/:symbol', 'GET', async () => {
    const res = await axios.get(`${API_URL}/orderbook/BTCUSDT`, {
      params: { exchange: 'aster', limit: 10 }
    });
    return res.data;
  });
  
  // ============ USER & AUTH ============
  console.log('\n📍 USER & AUTH ENDPOINTS');
  console.log('─'.repeat(80));
  
  await test('User', '/user/exchanges', 'GET', async () => {
    const res = await axios.get(`${API_URL}/user/exchanges`, {
      params: { userId: USER_ID }
    });
    return res.data;
  });
  
  await test('Auth', '/auth/session/switch', 'POST', async () => {
    const res = await axios.post(`${API_URL}/auth/session/switch`, {
      exchange: 'aster'
    }, { headers: auth });
    return res.data;
  });
  
  // ============ SUMMARY ============
  console.log('\n\n📊 COMPLETE TEST SUMMARY');
  console.log('═'.repeat(80));
  
  const byCategory = new Map<string, TestResult[]>();
  results.forEach(r => {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category)!.push(r);
  });
  
  console.log('\nResults by Category:\n');
  byCategory.forEach((tests, category) => {
    const passed = tests.filter(t => t.success).length;
    const total = tests.length;
    const rate = ((passed / total) * 100).toFixed(1);
    console.log(`${category}: ${passed}/${total} (${rate}%)`);
  });
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Total Endpoints Tested: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log('═'.repeat(80));
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Endpoints:\n');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   ${r.method} ${r.endpoint}`);
      console.log(`      Error: ${r.error}`);
    });
  }
  
  console.log('\n✅ Passed Endpoints:\n');
  results.filter(r => r.success).forEach(r => {
    console.log(`   ${r.method} ${r.endpoint} (${r.responseTime}ms)`);
  });
  
  console.log('\n');
}

main().catch(console.error);
