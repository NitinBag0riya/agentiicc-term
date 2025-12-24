/**
 * Comprehensive Trading Test
 * Tests: Orders, Positions, TP/SL, Cancel Order, Cancel All
 */

import axios from 'axios';
import { Client } from 'pg';
import 'dotenv/config';
import { initEncryption, encrypt } from './src/utils/encryption';

const API_URL = process.env.UNIVERSAL_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

const ASTER_API_KEY = process.env.ASTER_API_KEY!;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET!;
const TEST_TELEGRAM_ID = 7797429783;

const SYMBOL = 'BTCUSDT';
const EXCHANGE = 'aster';

interface TestResult { category: string; name: string; passed: boolean; error?: string; data?: any }
const results: TestResult[] = [];

function log(emoji: string, msg: string) { console.log(`${emoji} ${msg}`); }

async function test(cat: string, name: string, fn: () => Promise<any>) {
  try {
    const data = await fn();
    results.push({ category: cat, name, passed: true, data });
    log('✅', name);
    return data;
  } catch (e: any) {
    results.push({ category: cat, name, passed: false, error: e.message });
    log('❌', `${name}: ${e.message}`);
    return null;
  }
}

async function getDbClient() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

async function setupUser(): Promise<{ userId: number; token: string }> {
  const client = await getDbClient();
  
  // Get or create user
  let result = await client.query('SELECT id FROM users WHERE telegram_id = $1', [TEST_TELEGRAM_ID]);
  let userId: number;
  
  if (result.rows.length === 0) {
    const insert = await client.query(
      'INSERT INTO users (telegram_id, username, created_at) VALUES ($1, $2, NOW()) RETURNING id',
      [TEST_TELEGRAM_ID, 'test_user']
    );
    userId = insert.rows[0].id;
  } else {
    userId = result.rows[0].id;
  }

  // Ensure Aster is linked with correct encryption
  const encKey = encrypt(ASTER_API_KEY);
  const encSecret = encrypt(ASTER_API_SECRET);
  
  await client.query(
    `INSERT INTO api_credentials (user_id, api_key_encrypted, api_secret_encrypted, testnet, exchange_id)
     VALUES ($1, $2, $3, false, 'aster')
     ON CONFLICT (user_id, exchange_id) DO UPDATE SET 
       api_key_encrypted = $2, api_secret_encrypted = $3, updated_at = NOW()`,
    [userId, encKey, encSecret]
  );
  
  await client.end();

  // Get session token
  const session = await axios.post(`${API_URL}/auth/session`, { userId });
  return { userId, token: session.data.token };
}

async function api(token: string, method: string, path: string, data?: any, params?: any) {
  const config: any = {
    method,
    url: `${API_URL}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    params,
    data
  };
  const res = await axios(config);
  if (!res.data.success) throw new Error(res.data.error || 'API failed');
  return res.data;
}

async function main() {
  console.log('\n========================================');
  console.log('  🧪 COMPREHENSIVE TRADING TEST');
  console.log(`  Symbol: ${SYMBOL} | Exchange: ${EXCHANGE}`);
  console.log('========================================\n');

  // Initialize
  initEncryption(ENCRYPTION_KEY);
  log('🔐', 'Encryption initialized');

  let token = '';
  
  // Setup
  console.log('\n📍 SETUP\n');
  await test('Setup', 'Get session token', async () => {
    const result = await setupUser();
    token = result.token;
    console.log(`   → userId: ${result.userId}`);
  });

  // ==================== ACCOUNT & POSITION STATUS ====================
  console.log('\n📍 ACCOUNT STATUS\n');

  let balance = 0;
  await test('Account', 'Get account info', async () => {
    const res = await api(token, 'GET', '/account', null, { exchange: EXCHANGE });
    balance = parseFloat(res.data.availableBalance || res.data.balance || 0);
    console.log(`   → Available: $${balance.toFixed(2)}`);
  });

  let positions: any[] = [];
  await test('Account', 'Get positions', async () => {
    const res = await api(token, 'GET', '/positions', null, { exchange: EXCHANGE });
    positions = res.data || [];
    console.log(`   → Positions: ${positions.length}`);
  });

  let openOrders: any[] = [];
  await test('Account', 'Get open orders', async () => {
    const res = await api(token, 'GET', '/orders', null, { exchange: EXCHANGE, symbol: SYMBOL });
    openOrders = res.data || [];
    console.log(`   → Open orders: ${openOrders.length}`);
  });

  // ==================== ORDER TYPES ====================
  console.log('\n📍 ORDER TYPES\n');

  // Get current price
  let currentPrice = 0;
  await test('Orders', 'Get current price', async () => {
    const res = await axios.get(`${API_URL}/ticker/${SYMBOL}?exchange=${EXCHANGE}`);
    currentPrice = parseFloat(res.data.data.price);
    console.log(`   → BTC: $${currentPrice.toFixed(2)}`);
  });

  // Market Order (small amount to test)
  let marketOrderId: string | null = null;
  await test('Orders', 'Place MARKET LONG (0.001 BTC)', async () => {
    const res = await api(token, 'POST', '/order', {
      exchange: EXCHANGE,
      symbol: SYMBOL,
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001
    });
    marketOrderId = res.data?.orderId;
    console.log(`   → orderId: ${marketOrderId}`);
  });

  // Wait a bit for order to fill
  await new Promise(r => setTimeout(r, 2000));

  // Limit Order (far from market - won't fill)
  const limitPrice = Math.round(currentPrice * 0.9); // 10% below market
  let limitOrderId: string | null = null;
  await test('Orders', `Place LIMIT LONG @ $${limitPrice}`, async () => {
    const res = await api(token, 'POST', '/order', {
      exchange: EXCHANGE,
      symbol: SYMBOL,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 0.001,
      price: limitPrice
    });
    limitOrderId = res.data?.orderId;
    console.log(`   → orderId: ${limitOrderId}`);
  });

  // ==================== POSITION MANAGEMENT ====================
  console.log('\n📍 POSITION MANAGEMENT\n');

  // Check position after market order
  await test('Position', 'Get updated positions', async () => {
    const res = await api(token, 'GET', '/positions', null, { exchange: EXCHANGE });
    positions = res.data || [];
    const btcPosition = positions.find(p => p.symbol === SYMBOL);
    if (btcPosition) {
      console.log(`   → ${SYMBOL}: ${btcPosition.positionAmt} @ $${btcPosition.entryPrice}`);
    } else {
      console.log(`   → No ${SYMBOL} position`);
    }
  });

  // ==================== TP/SL ORDERS ====================
  console.log('\n📍 TP/SL ORDERS\n');

  // Take Profit using order endpoint
  const tpPrice = Math.round(currentPrice * 1.02); // 2% above
  await test('TP/SL', `Place TAKE_PROFIT @ $${tpPrice}`, async () => {
    const res = await api(token, 'POST', '/order', {
      exchange: EXCHANGE,
      symbol: SYMBOL,
      side: 'SELL',
      type: 'TAKE_PROFIT_MARKET',
      quantity: 0.001,
      stopPrice: tpPrice
    });
    console.log(`   → orderId: ${res.data?.orderId}`);
  });

  // Stop Loss using order endpoint
  const slPrice = Math.round(currentPrice * 0.98); // 2% below
  await test('TP/SL', `Place STOP_LOSS @ $${slPrice}`, async () => {
    const res = await api(token, 'POST', '/order', {
      exchange: EXCHANGE,
      symbol: SYMBOL,
      side: 'SELL',
      type: 'STOP_MARKET',
      quantity: 0.001,
      stopPrice: slPrice
    });
    console.log(`   → orderId: ${res.data?.orderId}`);
  });

  // ==================== ORDER CANCELLATION ====================
  console.log('\n📍 ORDER CANCELLATION\n');

  // Get all open orders
  await test('Cancel', 'Get all open orders', async () => {
    const res = await api(token, 'GET', '/orders', null, { exchange: EXCHANGE, symbol: SYMBOL });
    openOrders = res.data || [];
    console.log(`   → Open orders: ${openOrders.length}`);
    openOrders.forEach((o, i) => console.log(`      ${i+1}. ${o.type} ${o.side} ${o.origQty} @ $${o.price || o.stopPrice || 'market'}`));
  });

  // Cancel single order (the limit order)
  if (limitOrderId) {
    await test('Cancel', `Cancel limit order ${limitOrderId}`, async () => {
      const res = await api(token, 'DELETE', '/orders', {
        exchange: EXCHANGE,
        symbol: SYMBOL,
        orderId: limitOrderId
      });
      console.log(`   → Cancelled: ${res.data?.orderId || limitOrderId}`);
    });
  }

  // Cancel all remaining open orders (loop through and cancel each)
  await test('Cancel', 'Cancel ALL open orders', async () => {
    const ordersRes = await api(token, 'GET', '/orders', null, { exchange: EXCHANGE, symbol: SYMBOL });
    const remainingOrders = ordersRes.data || [];
    let cancelled = 0;
    for (const order of remainingOrders) {
      try {
        await api(token, 'DELETE', '/orders', {
          exchange: EXCHANGE,
          symbol: SYMBOL,
          orderId: order.orderId
        });
        cancelled++;
      } catch (e) {}
    }
    console.log(`   → Cancelled ${cancelled} orders for ${SYMBOL}`);
  });

  // ==================== CLOSE POSITION ====================
  console.log('\n📍 CLOSE POSITION\n');

  // Get current position
  await test('Close', 'Get current position', async () => {
    const res = await api(token, 'GET', '/positions', null, { exchange: EXCHANGE });
    positions = res.data || [];
    const btcPosition = positions.find(p => p.symbol === SYMBOL && parseFloat(p.positionAmt) !== 0);
    if (btcPosition) {
      console.log(`   → ${SYMBOL}: ${btcPosition.positionAmt}`);
    } else {
      console.log(`   → No open position`);
    }
  });

  // Close position with market order
  const btcPosition = positions.find(p => p.symbol === SYMBOL && parseFloat(p.positionAmt) !== 0);
  if (btcPosition) {
    const qty = Math.abs(parseFloat(btcPosition.positionAmt));
    const side = parseFloat(btcPosition.positionAmt) > 0 ? 'SELL' : 'BUY';
    
    await test('Close', `Close position (${side} ${qty})`, async () => {
      const res = await api(token, 'POST', '/order', {
        exchange: EXCHANGE,
        symbol: SYMBOL,
        side,
        type: 'MARKET',
        quantity: qty,
        reduceOnly: true
      });
      console.log(`   → Close orderId: ${res.data?.orderId}`);
    });
  } else {
    log('ℹ️', 'No position to close');
  }

  // ==================== FINAL STATUS ====================
  console.log('\n📍 FINAL STATUS\n');

  await test('Final', 'Account balance', async () => {
    const res = await api(token, 'GET', '/account', null, { exchange: EXCHANGE });
    const finalBalance = parseFloat(res.data.availableBalance || res.data.balance || 0);
    console.log(`   → Final balance: $${finalBalance.toFixed(2)}`);
    console.log(`   → Change: $${(finalBalance - balance).toFixed(2)}`);
  });

  await test('Final', 'Open orders', async () => {
    const res = await api(token, 'GET', '/orders', null, { exchange: EXCHANGE, symbol: SYMBOL });
    console.log(`   → Open orders: ${res.data?.length || 0}`);
  });

  await test('Final', 'Open positions', async () => {
    const res = await api(token, 'GET', '/positions', null, { exchange: EXCHANGE });
    const btc = res.data?.find((p: any) => p.symbol === SYMBOL);
    console.log(`   → ${SYMBOL} position: ${btc ? btc.positionAmt : '0'}`);
  });

  // ==================== SUMMARY ====================
  console.log('\n========================================');
  console.log('  📊 RESULTS');
  console.log('========================================\n');

  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const passed = catResults.filter(r => r.passed).length;
    const emoji = passed === catResults.length ? '✅' : '⚠️';
    console.log(`${emoji} ${cat}: ${passed}/${catResults.length}`);
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  
  console.log(`\n📈 TOTAL: ${totalPassed}/${results.length}`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed:');
    results.filter(r => !r.passed).forEach(r => console.log(`   - [${r.category}] ${r.name}: ${r.error}`));
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
  }

  console.log('\n');
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);
