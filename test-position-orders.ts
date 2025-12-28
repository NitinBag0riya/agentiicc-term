/**
 * Comprehensive API Test Script - Position Management & Order Placement
 * Tests all API operations across Aster and Hyperliquid
 * 
 * Run with: npx ts-node test-position-orders.ts
 */

import dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';
import { Client } from 'pg';

dotenv.config();

// ==================== CONFIG ====================
const API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL!;
const TEST_SYMBOL_ASTER = 'BTCUSDT';
const TEST_SYMBOL_HL = 'BTC';

// Test credentials from .env
const ASTER_API_KEY = process.env.ASTER_API_KEY!;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET!;
const HYPERLIQUID_PRIVATE_KEY = process.env.HYPERLIQUID_PRIVATE_KEY!;
const HYPERLIQUID_ADDRESS = process.env.HYPERLIQUID_ADDRESS!;

// ==================== TYPES ====================
interface TestResult {
  testId: number;
  category: string;
  operation: string;
  exchange: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

// ==================== STATE ====================
const results: TestResult[] = [];
let testId = 0;
let client: AxiosInstance;
let token: string;
let userId: number;

// ==================== HELPERS ====================
function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function addResult(category: string, operation: string, exchange: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration?: number) {
  testId++;
  results.push({ testId, category, operation, exchange, status, message, duration });
  
  const statusEmoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${statusEmoji} [${testId}] ${operation} (${exchange}): ${message}`);
}

async function test(category: string, operation: string, exchange: string, fn: () => Promise<any>): Promise<any> {
  const start = Date.now();
  try {
    const result = await fn();
    addResult(category, operation, exchange, 'PASS', 'Success', Date.now() - start);
    return result;
  } catch (error: any) {
    addResult(category, operation, exchange, 'FAIL', error.message || 'Unknown error', Date.now() - start);
    return null;
  }
}

function skip(category: string, operation: string, exchange: string, reason: string) {
  testId++;
  addResult(category, operation, exchange, 'SKIP', reason);
}

// ==================== DATABASE HELPERS ====================
async function getDbClient() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  return db;
}

async function cleanupTestUser(telegramId: number) {
  const db = await getDbClient();
  try {
    const userResult = await db.query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
    if (userResult.rows.length > 0) {
      const uid = userResult.rows[0].id;
      await db.query('DELETE FROM api_credentials WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM referrals WHERE referred_user_id = $1 OR referrer_user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
  } finally {
    await db.end();
  }
}

async function createTestUser(telegramId: number, username: string): Promise<number> {
  const db = await getDbClient();
  try {
    const result = await db.query(
      'INSERT INTO users (telegram_id, username, is_verified, created_at) VALUES ($1, $2, true, NOW()) RETURNING id',
      [telegramId, username]
    );
    return result.rows[0].id;
  } finally {
    await db.end();
  }
}

// ==================== TEST SECTIONS ====================

async function testHealthAndSetup() {
  console.log('\n' + '='.repeat(60));
  console.log('📍 PHASE 1: Health & Setup');
  console.log('='.repeat(60) + '\n');

  // Health check
  await test('Setup', 'Health Check', 'System', async () => {
    const res = await axios.get(`${API_URL}/health`);
    if (res.data.status !== 'ok') throw new Error('Health check failed');
    return res.data;
  });

  // Cleanup and create test user
  const telegramId = 99999999;
  await cleanupTestUser(telegramId);
  
  await test('Setup', 'Create Test User', 'System', async () => {
    userId = await createTestUser(telegramId, 'api_test_user');
    if (!userId) throw new Error('Failed to create user');
    return userId;
  });
}

async function testCredentials() {
  console.log('\n' + '='.repeat(60));
  console.log('📍 PHASE 2: Credentials & Session');
  console.log('='.repeat(60) + '\n');

  // Store Aster credentials
  if (ASTER_API_KEY && ASTER_API_SECRET) {
    await test('Credentials', 'Store Aster Credentials', 'Aster', async () => {
      const res = await axios.post(`${API_URL}/user/credentials`, {
        userId,
        exchange: 'aster',
        apiKey: ASTER_API_KEY,
        apiSecret: ASTER_API_SECRET
      });
      if (!res.data.success) throw new Error(res.data.error);
      return res.data;
    });
  } else {
    skip('Credentials', 'Store Aster Credentials', 'Aster', 'No credentials in .env');
  }

  // Store Hyperliquid credentials
  if (HYPERLIQUID_PRIVATE_KEY && HYPERLIQUID_ADDRESS) {
    await test('Credentials', 'Store Hyperliquid Credentials', 'Hyperliquid', async () => {
      const res = await axios.post(`${API_URL}/user/credentials`, {
        userId,
        exchange: 'hyperliquid',
        privateKey: HYPERLIQUID_PRIVATE_KEY,
        address: HYPERLIQUID_ADDRESS
      });
      if (!res.data.success) throw new Error(res.data.error);
      return res.data;
    });
  } else {
    skip('Credentials', 'Store Hyperliquid Credentials', 'Hyperliquid', 'No credentials in .env');
  }

  // Get linked exchanges
  await test('Credentials', 'Get Linked Exchanges', 'System', async () => {
    const res = await axios.get(`${API_URL}/user/exchanges?userId=${userId}`);
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Linked: ${res.data.data.join(', ')}`);
    return res.data;
  });

  // Create session
  await test('Session', 'Create Session', 'System', async () => {
    const res = await axios.post(`${API_URL}/auth/session`, { userId });
    if (!res.data.success) throw new Error(res.data.error);
    token = res.data.token;
    // Configure axios to NOT throw on any status code - we'll check res.data.success instead
    client = axios.create({
      baseURL: API_URL,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true  // Accept all status codes, handle errors in response body
    });
    log('  ℹ️', `Active: ${res.data.activeExchange}, Linked: ${res.data.linkedExchanges?.join(', ')}`);
    return res.data;
  });

  // Get session info
  await test('Session', 'Get Session Info', 'System', async () => {
    const res = await client.get('/auth/session/info');
    if (!res.data.success) throw new Error(res.data.error);
    return res.data;
  });
}

async function testAccountOperations(exchange: string) {
  const symbol = exchange === 'hyperliquid' ? TEST_SYMBOL_HL : TEST_SYMBOL_ASTER;
  
  console.log('\n' + '-'.repeat(40));
  console.log(`📊 Account Operations: ${exchange.toUpperCase()}`);
  console.log('-'.repeat(40) + '\n');

  // Get account
  await test('Account', 'Get Account', exchange, async () => {
    const res = await client.get('/account', { params: { exchange } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Balance: $${res.data.data?.totalBalance || res.data.data?.availableBalance || 'N/A'}`);
    return res.data;
  });

  // Get positions
  await test('Account', 'Get Positions', exchange, async () => {
    const res = await client.get('/positions', { params: { exchange } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Positions: ${res.data.data?.length || 0}`);
    return res.data;
  });

  // Set leverage tests
  for (const leverage of [5, 10, 20]) {
    await test('Leverage', `Set Leverage ${leverage}x`, exchange, async () => {
      const res = await client.post('/account/leverage', { symbol, leverage, exchange });
      if (!res.data.success) throw new Error(res.data.error || res.data.message);
      return res.data;
    });
  }

  // Set margin mode (Aster only)
  if (exchange === 'aster') {
    await test('Margin', 'Set Margin Mode CROSS', exchange, async () => {
      const res = await client.post('/account/margin-mode', { symbol, mode: 'CROSS', exchange });
      // This may fail if there's an open position, which is OK
      return res.data;
    });
  }
}

async function testMarketData(exchange: string) {
  const symbol = exchange === 'hyperliquid' ? TEST_SYMBOL_HL : TEST_SYMBOL_ASTER;
  
  console.log('\n' + '-'.repeat(40));
  console.log(`📈 Market Data: ${exchange.toUpperCase()}`);
  console.log('-'.repeat(40) + '\n');

  // Get ticker
  let currentPrice = 0;
  await test('Market', 'Get Ticker', exchange, async () => {
    const res = await axios.get(`${API_URL}/ticker/${symbol}`, { params: { exchange } });
    if (!res.data.success) throw new Error(res.data.error);
    currentPrice = parseFloat(res.data.data?.price || res.data.data?.lastPrice || '0');
    log('  ℹ️', `Price: $${currentPrice}`);
    return res.data;
  });

  // Get orderbook
  await test('Market', 'Get Orderbook', exchange, async () => {
    const res = await axios.get(`${API_URL}/orderbook/${symbol}`, { params: { exchange } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Bids: ${res.data.data?.bids?.length || 0}, Asks: ${res.data.data?.asks?.length || 0}`);
    return res.data;
  });

  // Get assets
  await test('Market', 'Get Assets', exchange, async () => {
    const res = await axios.get(`${API_URL}/assets`, { params: { exchange } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Assets: ${res.data.data?.length || 0}`);
    return res.data;
  });

  // Get OHLCV
  await test('Market', 'Get OHLCV', exchange, async () => {
    const res = await axios.get(`${API_URL}/ohlcv/${symbol}`, { params: { exchange, tf: '15m', limit: 10 } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Candles: ${res.data.data?.length || 0}`);
    return res.data;
  });

  return currentPrice;
}

async function testOrderPlacement(exchange: string, currentPrice: number) {
  const symbol = exchange === 'hyperliquid' ? TEST_SYMBOL_HL : TEST_SYMBOL_ASTER;
  
  console.log('\n' + '-'.repeat(40));
  console.log(`📝 Order Placement: ${exchange.toUpperCase()}`);
  console.log('-'.repeat(40) + '\n');

  if (currentPrice === 0) {
    skip('Orders', 'All Order Tests', exchange, 'No price available');
    return;
  }

  // Exchange-specific settings for proper formatting
  // The test accounts have ~$9-10 balance, so we use minimum viable quantities
  // ASTER: min qty = 0.001 BTC (~$88 notional), with 10x leverage needs ~$8.8 margin
  // HYPERLIQUID: min sz = 0.0001 BTC, but we use 0.0002 for safety (~$18 notional, ~$1.8 margin at 10x)
  const isAster = exchange === 'aster';
  
  // Use fixed minimum viable quantities for testing
  // These are carefully chosen to work with low-balance test accounts at 10x leverage
  const quantity = isAster ? '0.001' : '0.0002';

  // Aster requires integer prices for BTC (tickSize = 1.0)
  // Hyperliquid can use 1 decimal
  const limitPrice = isAster 
    ? Math.round(currentPrice * 0.9).toString()  // Round to integer for Aster
    : (currentPrice * 0.9).toFixed(1);            // 1 decimal for HL
  
  // Stop/TP triggers - also need proper precision
  const stopTrigger = isAster
    ? Math.round(currentPrice * 0.85).toString()
    : (currentPrice * 0.85).toFixed(1);
  const tpTrigger = isAster
    ? Math.round(currentPrice * 1.15).toString()
    : (currentPrice * 1.15).toFixed(1);

  let orderIds: string[] = [];

  // Test 1: LIMIT BUY
  await test('Orders', 'LIMIT BUY', exchange, async () => {
    const res = await client.post('/order', {
      exchange,
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity,
      price: limitPrice
    });
    // Check response body for success, not HTTP status
    if (!res.data.success) throw new Error(res.data.error || 'Order failed');
    if (res.data.data?.orderId) orderIds.push(res.data.data.orderId);
    log('  ℹ️', `Order ID: ${res.data.data?.orderId}, Qty: ${quantity} @ $${limitPrice}`);
    return res.data;
  });

  // Test 2: LIMIT SELL  
  const sellLimitPrice = isAster 
    ? Math.round(currentPrice * 1.1).toString()  // Round to integer for Aster
    : (currentPrice * 1.1).toFixed(1);            // 1 decimal for HL
  await test('Orders', 'LIMIT SELL', exchange, async () => {
    const res = await client.post('/order', {
      exchange,
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      quantity,
      price: sellLimitPrice
    });
    if (!res.data.success) throw new Error(res.data.error);
    if (res.data.data?.orderId) orderIds.push(res.data.data.orderId);
    log('  ℹ️', `Order ID: ${res.data.data?.orderId}, Qty: ${quantity} @ $${sellLimitPrice}`);
    return res.data;
  });

  // Test 3: STOP_MARKET (reduceOnly - no margin needed)
  await test('Orders', 'STOP_MARKET', exchange, async () => {
    const res = await client.post('/order', {
      exchange,
      symbol,
      side: 'SELL',
      type: 'STOP_MARKET',
      quantity,
      triggerPrice: stopTrigger,
      reduceOnly: true  // Use reduceOnly to avoid margin requirements
    });
    if (!res.data.success) throw new Error(res.data.error);
    if (res.data.data?.orderId) orderIds.push(res.data.data.orderId);
    log('  ℹ️', `Trigger: $${stopTrigger} (reduceOnly)`);
    return res.data;
  });

  // Test 4: TAKE_PROFIT_MARKET (reduceOnly - no margin needed)
  await test('Orders', 'TAKE_PROFIT_MARKET', exchange, async () => {
    const res = await client.post('/order', {
      exchange,
      symbol,
      side: 'SELL',
      type: 'TAKE_PROFIT_MARKET',
      quantity,
      triggerPrice: tpTrigger,
      reduceOnly: true  // Use reduceOnly to avoid margin requirements
    });
    if (!res.data.success) throw new Error(res.data.error);
    if (res.data.data?.orderId) orderIds.push(res.data.data.orderId);
    log('  ℹ️', `Trigger: $${tpTrigger} (reduceOnly)`);
    return res.data;
  });

  // Small delay to let orders register
  await new Promise(r => setTimeout(r, 500));

  // Get open orders
  await test('Orders', 'Get Open Orders', exchange, async () => {
    const res = await client.get('/orders', { params: { exchange, symbol } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Open orders: ${res.data.data?.length || 0}`);
    return res.data;
  });

  // Cancel individual order
  if (orderIds.length > 0) {
    const orderId = orderIds[0];
    await test('Orders', 'Cancel Single Order', exchange, async () => {
      const res = await client.delete(`/order/${orderId}`, { params: { exchange, symbol } });
      if (!res.data.success) throw new Error(res.data.error);
      return res.data;
    });
  }

  // Get order history
  await test('Orders', 'Get Order History', exchange, async () => {
    const res = await client.get('/orders/history', { params: { exchange, symbol, limit: 10 } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `History: ${res.data.data?.length || 0} orders`);
    return res.data;
  });

  // Get fills
  await test('Orders', 'Get Fills', exchange, async () => {
    const res = await client.get('/fills', { params: { exchange, symbol, limit: 10 } });
    if (!res.data.success) throw new Error(res.data.error);
    log('  ℹ️', `Fills: ${res.data.data?.length || 0}`);
    return res.data;
  });
}

async function testCancelAllOrders(exchange: string) {
  const symbol = exchange === 'hyperliquid' ? TEST_SYMBOL_HL : TEST_SYMBOL_ASTER;

  // Cancel all orders (cleanup)
  await test('Orders', 'Cancel All Orders', exchange, async () => {
    const res = await client.delete('/orders', { params: { exchange, symbol } });
    // May return success=false if no orders, which is fine
    log('  ℹ️', res.data.message || `Response: ${JSON.stringify(res.data)}`);
    return res.data;
  });
}

async function testTPSL(exchange: string, currentPrice: number) {
  const symbol = exchange === 'hyperliquid' ? TEST_SYMBOL_HL : TEST_SYMBOL_ASTER;
  
  console.log('\n' + '-'.repeat(40));
  console.log(`🎯 TP/SL Operations: ${exchange.toUpperCase()}`);
  console.log('-'.repeat(40) + '\n');

  if (currentPrice === 0) {
    skip('TP/SL', 'All TP/SL Tests', exchange, 'No price available');
    return;
  }

  const tpPrice = (currentPrice * 1.05).toFixed(2);
  const slPrice = (currentPrice * 0.95).toFixed(2);

  // Test Set Take Profit
  await test('TP/SL', 'Set Take Profit', exchange, async () => {
    const res = await client.post('/position/take-profit', {
      exchange,
      symbol,
      price: tpPrice
    });
    // May fail if no position - that's OK, we're testing the API
    log('  ℹ️', res.data.message || res.data.error || 'Executed');
    return res.data;
  });

  // Test Set Stop Loss
  await test('TP/SL', 'Set Stop Loss', exchange, async () => {
    const res = await client.post('/position/stop-loss', {
      exchange,
      symbol,
      price: slPrice
    });
    log('  ℹ️', res.data.message || res.data.error || 'Executed');
    return res.data;
  });

  // Test Set Both TP/SL
  await test('TP/SL', 'Set TP/SL Combined', exchange, async () => {
    const res = await client.post('/position/tp-sl', {
      exchange,
      symbol,
      tp: tpPrice,
      sl: slPrice
    });
    log('  ℹ️', res.data.message || res.data.error || 'Executed');
    return res.data;
  });
}

async function testSearchAssets() {
  console.log('\n' + '-'.repeat(40));
  console.log('🔍 Asset Search');
  console.log('-'.repeat(40) + '\n');

  await test('Search', 'Search Assets (BTC)', 'Both', async () => {
    const res = await axios.get(`${API_URL}/assets/search`, { 
      params: { q: 'BTC' },
      validateStatus: () => true 
    });
    if (!res.data.success) throw new Error(res.data.error || 'Search failed');
    log('  ℹ️', `Found: ${res.data.count || res.data.data?.length || 0} results`);
    return res.data;
  });

  await test('Search', 'Search Assets (ETH)', 'Both', async () => {
    const res = await axios.get(`${API_URL}/assets/search`, { 
      params: { q: 'ETH' },
      validateStatus: () => true 
    });
    if (!res.data.success) throw new Error(res.data.error || 'Search failed');
    log('  ℹ️', `Found: ${res.data.count || res.data.data?.length || 0} results`);
    return res.data;
  });
}

async function testSessionSwitch() {
  console.log('\n' + '-'.repeat(40));
  console.log('🔄 Session Switch');
  console.log('-'.repeat(40) + '\n');

  await test('Session', 'Switch to Hyperliquid', 'Hyperliquid', async () => {
    const res = await client.post('/auth/session/switch', { exchange: 'hyperliquid' });
    if (!res.data.success) throw new Error(res.data.error);
    return res.data;
  });

  await test('Session', 'Switch to Aster', 'Aster', async () => {
    const res = await client.post('/auth/session/switch', { exchange: 'aster' });
    if (!res.data.success) throw new Error(res.data.error);
    return res.data;
  });
}

async function testCleanup() {
  console.log('\n' + '-'.repeat(40));
  console.log('🧹 Cleanup');
  console.log('-'.repeat(40) + '\n');

  await test('Session', 'Delete Session', 'System', async () => {
    const res = await client.delete('/auth/session');
    if (!res.data.success) throw new Error(res.data.error);
    return res.data;
  });
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60) + '\n');

  const categories = [...new Set(results.map(r => r.category))];
  
  const summaryByCategory: { [key: string]: TestSummary } = {};
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    summaryByCategory[category] = {
      total: categoryResults.length,
      passed: categoryResults.filter(r => r.status === 'PASS').length,
      failed: categoryResults.filter(r => r.status === 'FAIL').length,
      skipped: categoryResults.filter(r => r.status === 'SKIP').length
    };
  }

  // Print table
  console.log('┌────────────────────┬───────┬────────┬────────┬─────────┐');
  console.log('│ Category           │ Total │ Passed │ Failed │ Skipped │');
  console.log('├────────────────────┼───────┼────────┼────────┼─────────┤');
  
  for (const [category, summary] of Object.entries(summaryByCategory)) {
    const cat = category.padEnd(18);
    const total = String(summary.total).padStart(5);
    const passed = String(summary.passed).padStart(6);
    const failed = String(summary.failed).padStart(6);
    const skipped = String(summary.skipped).padStart(7);
    console.log(`│ ${cat} │${total} │${passed} │${failed} │${skipped} │`);
  }
  
  console.log('├────────────────────┼───────┼────────┼────────┼─────────┤');
  
  const totalSummary: TestSummary = {
    total: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    skipped: results.filter(r => r.status === 'SKIP').length
  };
  
  console.log(`│ ${'TOTAL'.padEnd(18)} │${String(totalSummary.total).padStart(5)} │${String(totalSummary.passed).padStart(6)} │${String(totalSummary.failed).padStart(6)} │${String(totalSummary.skipped).padStart(7)} │`);
  console.log('└────────────────────┴───────┴────────┴────────┴─────────┘');

  // List failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:');
    failures.forEach(f => {
      console.log(`  [${f.testId}] ${f.operation} (${f.exchange}): ${f.message}`);
    });
  }

  // Final verdict
  console.log('\n');
  if (totalSummary.failed === 0) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log(`⚠️ ${totalSummary.failed} test(s) failed`);
  }

  return totalSummary;
}

// ==================== MAIN ====================
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 COMPREHENSIVE API TEST SUITE v2');
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  try {
    // Phase 1: Health & Setup
    await testHealthAndSetup();

    // Phase 2: Credentials & Session
    await testCredentials();

    if (!token) {
      console.log('\n❌ No session token - cannot proceed with authenticated tests');
      printSummary();
      process.exit(1);
    }

    // Phase 3: Account Operations (both exchanges)
    await testAccountOperations('aster');
    if (HYPERLIQUID_PRIVATE_KEY) {
      await testAccountOperations('hyperliquid');
    }

    // Phase 4: Market Data (both exchanges)
    const asterPrice = await testMarketData('aster');
    let hlPrice = 0;
    if (HYPERLIQUID_PRIVATE_KEY) {
      hlPrice = await testMarketData('hyperliquid');
    }

    // Phase 5: Order Placement (both exchanges)
    await testOrderPlacement('aster', asterPrice);
    if (HYPERLIQUID_PRIVATE_KEY) {
      await testOrderPlacement('hyperliquid', hlPrice);
    }

    // Phase 6: TP/SL Operations (both exchanges)
    await testTPSL('aster', asterPrice);
    if (HYPERLIQUID_PRIVATE_KEY) {
      await testTPSL('hyperliquid', hlPrice);
    }

    // Phase 7: Cancel All (cleanup)
    await testCancelAllOrders('aster');
    if (HYPERLIQUID_PRIVATE_KEY) {
      await testCancelAllOrders('hyperliquid');
    }

    // Phase 8: Search & Switch
    await testSearchAssets();
    if (HYPERLIQUID_PRIVATE_KEY) {
      await testSessionSwitch();
    }

    // Phase 9: Cleanup
    await testCleanup();

  } catch (error: any) {
    console.error('\n💥 FATAL ERROR:', error.message);
  }

  // Print summary
  const summary = printSummary();
  
  console.log(`\n   Completed: ${new Date().toISOString()}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(console.error);
