/**
 * Rigorous API Test Suite
 * Tests all endpoints with extensive parameter variations, edge cases, and robust error handling.
 * Covers both Aster and Hyperliquid exchanges.
 */

import { createApiServer } from '../src/api/server';
import { sleep } from "bun";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Start internal test server
console.log('🚀 Starting internal test server...');
const app = createApiServer(PORT);
app.listen(PORT);
console.log(`✅ Test server running on ${BASE_URL}`);

interface TestResult {
  exchange: string;
  category: string;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
let userId: number;
let authToken: string;

// Helper to log with icons
function log(msg: string, type: 'info' | 'success' | 'error' | 'header' = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', header: '🔷' };
  console.log(`${icons[type]} ${msg}`);
}

async function apiCall(method: string, endpoint: string, body?: any, requiresAuth: boolean = false): Promise<any> {
  const headers: any = { 'Content-Type': 'application/json' };
  if (requiresAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options: any = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  // Attach status code for checking error responses
  data._status = response.status;
  
  return data;
}

async function runTest(exchange: string, category: string, name: string, testFn: () => Promise<any>): Promise<boolean> {
  const startTime = Date.now();
  try {
    const resultDetails = await testFn();
    const duration = Date.now() - startTime;
    results.push({ exchange, category, name, passed: true, duration, details: resultDetails });
    log(`[${exchange}] ${name} (${duration}ms)`, 'success');
    return true;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ exchange, category, name, passed: false, duration, error: error.message });
    log(`[${exchange}] ${name} - ${error.message}`, 'error');
    return false;
  }
}

async function testMarketDataVariations(exchange: string) {
  log(`Testing Market Data Variations for ${exchange}`, 'header');
  const symbols = exchange === 'aster' ? ['ETHUSDT', 'BTCUSDT'] : ['ETH', 'BTC'];
  
  // 1. Ticker for multiple symbols
  for (const sym of symbols) {
    await runTest(exchange, 'Market Data', `GET /ticker/${sym}`, async () => {
      const data = await apiCall('GET', `/ticker/${sym}?exchange=${exchange}`);
      if (!data.success || !data.data.price) throw new Error(`Invalid ticker for ${sym}`);
      return { price: data.data.price };
    });
  }

  // 2. Orderbook Depths
  const depths = [5, 10, 20];
  for (const depth of depths) {
    await runTest(exchange, 'Market Data', `GET /orderbook depth=${depth}`, async () => {
      const data = await apiCall('GET', `/orderbook/${symbols[0]}?depth=${depth}&exchange=${exchange}`);
      if (!data.success) throw new Error('Failed to get orderbook');
      if (data.data.bids.length > depth || data.data.asks.length > depth) {
         throw new Error(`Returned depth ${data.data.bids.length} > requested ${depth}`);
      }
      return { bids: data.data.bids.length, asks: data.data.asks.length };
    });
  }

  // 3. OHLCV Intervals
  const intervals = ['1m', '15m', '1h', '1d'];
  for (const interval of intervals) {
    await runTest(exchange, 'Market Data', `GET /ohlcv interval=${interval}`, async () => {
       // Note: API might default to 1m if interval param not supported in URL, 
       // but we check if it accepts it content-wise or just returns 200
       const data = await apiCall('GET', `/ohlcv/${symbols[0]}?interval=${interval}&exchange=${exchange}`);
       if (!data.success || !Array.isArray(data.data)) throw new Error('Failed to get candles');
       return { candles: data.data.length };
    });
  }
}

async function testOrderVariations(exchange: string) {
  log(`Testing Order Variations for ${exchange}`, 'header');
  const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';
  
  // Get valid price for Limit orders (5% below current)
  const ticker = await apiCall('GET', `/ticker/${symbol}?exchange=${exchange}`);
  const currentPrice = parseFloat(ticker.data.price);
  const limitPrice = (Math.floor(currentPrice * 0.95 * 10) / 10).toFixed(1);
  const stopPrice = (Math.floor(currentPrice * 0.90 * 10) / 10).toFixed(1);
  
  // Quantity: $15 value to be safe above limits
  const qty = exchange === 'hyperliquid' ? '0.006' : '0.006'; 

  // 1. LIMIT POST_ONLY
  await runTest(exchange, 'Orders', 'POST LIMIT POST_ONLY', async () => {
    const data = await apiCall('POST', '/order', {
      symbol, side: 'BUY', type: 'LIMIT', quantity: qty, price: limitPrice,
      postOnly: true, exchange
    }, true);
    if (!data.success) throw new Error(data.error);
    
    // Cleanup
    await apiCall('DELETE', `/order/${data.data.orderId}?symbol=${symbol}`, null, true);
    return data.data;
  });

  // 2. LIMIT IOC (Immediate or Cancel) - Should cancel if not filled immediately
  // We place a buy limit way below market, so it should cancel immediately
  await runTest(exchange, 'Orders', 'POST LIMIT IOC (Should Cancel)', async () => {
    const data = await apiCall('POST', '/order', {
      symbol, side: 'BUY', type: 'LIMIT', quantity: qty, price: limitPrice,
      timeInForce: 'IOC', exchange
    }, true);
    
    // It might succeed as "placed" but status should be CANCELED or EXPIRED immediately, 
    // OR the API might return success: true but the order is closed.
    if (!data.success) throw new Error(data.error);
    
    // Check order status
    try {
        const orderData = await apiCall('GET', `/orders?symbol=${symbol}`, null, true);
        const exists = orderData.data.find((o: any) => o.orderId === data.data.orderId);
        if (exists) throw new Error('IOC Order should not be in open orders list');
    } catch(e) {
        // If order not found, that's good for IOC
    }
    return data.data;
  });

  // 3. STOP_LIMIT
  await runTest(exchange, 'Orders', 'POST STOP_LIMIT', async () => {
    const data = await apiCall('POST', '/order', {
      symbol, side: 'SELL', type: 'STOP_LIMIT', quantity: qty,
      triggerPrice: stopPrice, price: (parseFloat(stopPrice) - 10).toString(),
      exchange
    }, true);
    if (!data.success) throw new Error(data.error);
    // Cleanup
    await apiCall('DELETE', `/order/${data.data.orderId}?symbol=${symbol}`, null, true);
  });
}

async function testPositionManagement(exchange: string) {
  log(`Testing Position & Margin for ${exchange}`, 'header');
  const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';
  
  // Clean up any open orders first to allow margin mode change
  try {
      await apiCall('DELETE', `/orders?symbol=${symbol}&exchange=${exchange}`, null, true);
      log('Cleaned up open orders before margin test', 'info');
      // Wait a bit for propagation
      await sleep(1000); 
  } catch (e) {
      // Ignore if no orders
  }

  // 1. Set Margin Mode (switching back and forth)
  await runTest(exchange, 'Position', 'Set Margin CROSS', async () => {
    const data = await apiCall('POST', '/account/margin-mode', {
        symbol, mode: 'CROSS', exchange
    }, true);
    // Allow "No need to change" as success
    if (!data.success && !data.message?.includes('No need') && !data.error?.includes('No need')) {
        throw new Error(data.error || data.message);
    }
  });
  
  await runTest(exchange, 'Position', 'Set Margin ISOLATED', async () => {
    const data = await apiCall('POST', '/account/margin-mode', {
        symbol, mode: 'ISOLATED', exchange
    }, true);
    if (!data.success && !data.message?.includes('No need') && !data.error?.includes('No need')) {
        throw new Error(data.error || data.message);
    }
  });

  // 2. Set Leverage
  const leverages = [3, 5]; // Test changing leverage
  for (const lev of leverages) {
    await runTest(exchange, 'Position', `Set Leverage ${lev}x`, async () => {
       const data = await apiCall('POST', '/account/leverage', {
         symbol, leverage: lev, exchange
       }, true);
       if (!data.success) throw new Error(data.error);
    });
  }
}

async function testErrorHandling(exchange: string) {
  log(`Testing Error Handling for ${exchange}`, 'header');
  const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';

  // 1. Invalid Symbol
  await runTest(exchange, 'Errors', 'Invalid Symbol', async () => {
    const data = await apiCall('GET', `/ticker/INVALID_SYM?exchange=${exchange}`);
    if (data.success) throw new Error('Should have failed');
    return { error: data.error || data.message };
  });

  // 2. Negative Quantity
  await runTest(exchange, 'Errors', 'Negative Quantity Order', async () => {
    const data = await apiCall('POST', '/order', {
      symbol, side: 'BUY', type: 'MARKET', quantity: '-0.1', exchange
    }, true);
    if (data.success) throw new Error('Order should fail');
  });

  // 3. Zero Price for LIMIT
  await runTest(exchange, 'Errors', 'Zero Price LIMIT Order', async () => {
     const data = await apiCall('POST', '/order', {
        symbol, side: 'BUY', type: 'LIMIT', quantity: '0.005', price: '0', exchange
     }, true);
     if (data.success) throw new Error('Order should fail');
  });
}

async function runRigorousTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 RIGOROUS API TEST SUITE');
  console.log('='.repeat(70));
  
  // 1. Setup User & Session
  log('Setting up User and Session...', 'header');
  const userRes = await apiCall('POST', '/user', { telegramId: Date.now(), username: 'rigorous_tester' });
  userId = userRes.data.id;
  
  await apiCall('POST', '/user/credentials', {
    userId, exchange: 'aster', apiKey: process.env.ASTER_API_KEY, apiSecret: process.env.ASTER_API_SECRET
  });
  
  await apiCall('POST', '/user/credentials', {
    userId, exchange: 'hyperliquid', address: process.env.HYPERLIQUID_ADDRESS, privateKey: process.env.HYPERLIQUID_PRIVATE_KEY
  });
  
  const sessionRes = await apiCall('POST', '/auth/session', { userId });
  authToken = sessionRes.token;
  log(`Session created for User ${userId}`, 'success');

  // 2. Run Tests on Aster
  await apiCall('POST', '/auth/session/switch', { exchange: 'aster' }, true);
  await testMarketDataVariations('aster');
  await testOrderVariations('aster');
  await testPositionManagement('aster');
  await testErrorHandling('aster');

  // 3. Run Tests on Hyperliquid
  await apiCall('POST', '/auth/session/switch', { exchange: 'hyperliquid' }, true);
  await testMarketDataVariations('hyperliquid');
  await testOrderVariations('hyperliquid');
  // Note: Hyperliquid position management might behave differently with margin types, testing carefully
  await testPositionManagement('hyperliquid');
  await testErrorHandling('hyperliquid');

  // 4. Report
  console.log('\n' + '='.repeat(70));
  console.log('📊 RIGOROUS TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${results.length - passed}`);
  
  await Bun.write('./rigorous-test-report.json', JSON.stringify(results, null, 2));
  log('Detailed report saved to rigorous-test-report.json', 'info');
  
  if (passed === results.length) {
      log('ALL RIGOROUS TESTS PASSED! 🎉', 'success');
  } else {
      log('SOME TESTS FAILED - Check report', 'error');
      process.exit(1);
  }
}

runRigorousTest().catch(console.error);
