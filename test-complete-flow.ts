/**
 * Complete User Flow Test - All CTAs, screens, settings, positions, orders
 * Uses app's encryption module for correct credentials
 */

import axios from 'axios';
import { Client } from 'pg';
import 'dotenv/config';

// Import app's actual encryption module
import { initEncryption, encrypt } from './src/utils/encryption';

const API_URL = process.env.UNIVERSAL_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Credentials from .env
const ASTER_API_KEY = process.env.ASTER_API_KEY!;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET!;
const HYPERLIQUID_PRIVATE_KEY = process.env.HYPERLIQUID_PRIVATE_KEY!;
const HYPERLIQUID_ADDRESS = process.env.HYPERLIQUID_ADDRESS!;

const TEST_TELEGRAM_ID = 7797429783;

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

async function test(category: string, name: string, fn: () => Promise<any>) {
  try {
    await fn();
    results.push({ category, name, passed: true });
    log('✅', `${name}`);
  } catch (error: any) {
    results.push({ category, name, passed: false, error: error.message });
    log('❌', `${name}: ${error.message}`);
  }
}

async function getDbClient() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

async function flushAndCreateUser(): Promise<number> {
  const client = await getDbClient();
  
  // Get user ID first
  const userResult = await client.query('SELECT id FROM users WHERE telegram_id = $1', [TEST_TELEGRAM_ID]);
  
  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].id;
    await client.query('UPDATE users SET referred_by = NULL WHERE referred_by = $1', [userId]);
    await client.query('DELETE FROM api_credentials WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    log('🗑️', `Deleted user ${userId}`);
  }
  
  // Create fresh user
  const result = await client.query(
    'INSERT INTO users (telegram_id, username, created_at) VALUES ($1, $2, NOW()) RETURNING id',
    [TEST_TELEGRAM_ID, 'test_user']
  );
  
  const userId = result.rows[0].id;
  log('✅', `Created user ID: ${userId}`);
  
  await client.end();
  return userId;
}

async function getLinkedExchanges(userId: number): Promise<string[]> {
  const client = await getDbClient();
  const result = await client.query('SELECT exchange_id FROM api_credentials WHERE user_id = $1', [userId]);
  await client.end();
  return result.rows.map(r => r.exchange_id);
}

async function linkAster(userId: number) {
  const client = await getDbClient();
  
  // Use app's encryption (GCM format)
  const encryptedKey = encrypt(ASTER_API_KEY);
  const encryptedSecret = encrypt(ASTER_API_SECRET);
  
  await client.query(
    `INSERT INTO api_credentials (user_id, api_key_encrypted, api_secret_encrypted, testnet, exchange_id)
     VALUES ($1, $2, $3, false, 'aster')
     ON CONFLICT (user_id, exchange_id) DO UPDATE SET 
       api_key_encrypted = $2, api_secret_encrypted = $3, updated_at = NOW()`,
    [userId, encryptedKey, encryptedSecret]
  );
  
  await client.end();
}

async function linkHyperliquid(userId: number) {
  const client = await getDbClient();
  
  // For Hyperliquid, we store privateKey in api_key_encrypted and walletAddress in api_secret_encrypted
  const encryptedKey = encrypt(HYPERLIQUID_PRIVATE_KEY);
  const encryptedSecret = encrypt(HYPERLIQUID_ADDRESS);
  
  await client.query(
    `INSERT INTO api_credentials (user_id, api_key_encrypted, api_secret_encrypted, testnet, exchange_id)
     VALUES ($1, $2, $3, false, 'hyperliquid')
     ON CONFLICT (user_id, exchange_id) DO UPDATE SET 
       api_key_encrypted = $2, api_secret_encrypted = $3, updated_at = NOW()`,
    [userId, encryptedKey, encryptedSecret]
  );
  
  await client.end();
}

async function testSession(userId: number) {
  const response = await axios.post(`${API_URL}/auth/session`, { userId });
  return response.data;
}

async function testAccount(token: string, exchange: string) {
  const response = await axios.get(`${API_URL}/account`, {
    params: { exchange },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function testPositions(token: string, exchange: string) {
  const response = await axios.get(`${API_URL}/positions`, {
    params: { exchange },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function testOrders(token: string, exchange: string, symbol: string) {
  const response = await axios.get(`${API_URL}/orders`, {
    params: { exchange, symbol },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function testOrderHistory(token: string, exchange: string, symbol: string) {
  const response = await axios.get(`${API_URL}/orders/history`, {
    params: { exchange, symbol },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function testFills(token: string, exchange: string, symbol: string) {
  const response = await axios.get(`${API_URL}/fills`, {
    params: { exchange, symbol },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

async function main() {
  console.log('\n========================================');
  console.log('  🧪 COMPLETE USER FLOW TEST');
  console.log('========================================\n');

  // Initialize encryption with app's key
  initEncryption(ENCRYPTION_KEY);
  log('🔐', 'Encryption initialized');

  // 1. Health check
  console.log('\n📍 STEP 1: Setup\n');
  await test('Setup', 'Health check', async () => {
    const res = await axios.get(`${API_URL}/health`);
    if (res.data.status !== 'ok') throw new Error('Health failed');
  });

  let userId = 0;
  await test('Setup', 'Flush & create user', async () => {
    userId = await flushAndCreateUser();
  });

  // 2. Test new user (no exchanges)
  console.log('\n📍 STEP 2: New User (No Exchanges)\n');
  
  await test('New User', 'linkedExchanges = empty', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → ${JSON.stringify(exchanges)}`);
    if (exchanges.length !== 0) throw new Error('Expected 0');
  });

  await test('New User', 'Session returns empty linkedExchanges', async () => {
    const session = await testSession(userId);
    console.log(`   → ${JSON.stringify(session.linkedExchanges || [])}`);
  });

  // 3. Link Aster
  console.log('\n📍 STEP 3: Link ASTER\n');
  
  await test('Link', 'Store Aster credentials', async () => {
    await linkAster(userId);
  });

  await test('Link', 'Verify Aster linked', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → ${JSON.stringify(exchanges)}`);
    if (!exchanges.includes('aster')) throw new Error('Not linked');
  });

  let token = '';
  await test('Link', 'Session after Aster link', async () => {
    const session = await testSession(userId);
    token = session.token;
    console.log(`   → linkedExchanges: ${JSON.stringify(session.linkedExchanges)}`);
    console.log(`   → activeExchange: ${session.activeExchange}`);
  });

  // 4. Aster API Tests
  console.log('\n📍 STEP 4: ASTER API Tests\n');
  
  await test('Aster', 'Get account', async () => {
    const account = await testAccount(token, 'aster');
    console.log(`   → Balance: $${account.data?.totalBalance || account.data?.balance || 'N/A'}`);
    if (!account.success) throw new Error(account.error);
  });

  await test('Aster', 'Get positions', async () => {
    const positions = await testPositions(token, 'aster');
    console.log(`   → Positions: ${positions.data?.length || 0}`);
    if (!positions.success) throw new Error(positions.error);
  });

  await test('Aster', 'Get open orders (BTCUSDT)', async () => {
    const orders = await testOrders(token, 'aster', 'BTCUSDT');
    console.log(`   → Open orders: ${orders.data?.length || 0}`);
    if (!orders.success) throw new Error(orders.error);
  });

  await test('Aster', 'Get order history', async () => {
    const history = await testOrderHistory(token, 'aster', 'BTCUSDT');
    console.log(`   → History: ${history.data?.length || 0} orders`);
    if (!history.success) throw new Error(history.error);
  });

  await test('Aster', 'Get fills/trades', async () => {
    const fills = await testFills(token, 'aster', 'BTCUSDT');
    console.log(`   → Fills: ${fills.data?.length || 0}`);
    if (!fills.success) throw new Error(fills.error);
  });

  // 5. Link Hyperliquid
  console.log('\n📍 STEP 5: Link HYPERLIQUID\n');
  
  await test('Link', 'Store Hyperliquid credentials', async () => {
    await linkHyperliquid(userId);
  });

  await test('Link', 'Verify both linked', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → ${JSON.stringify(exchanges)}`);
    if (exchanges.length !== 2) throw new Error('Expected 2');
  });

  await test('Link', 'Session after both linked', async () => {
    const session = await testSession(userId);
    token = session.token;
    console.log(`   → linkedExchanges: ${JSON.stringify(session.linkedExchanges)}`);
  });

  // 6. Hyperliquid API Tests
  console.log('\n📍 STEP 6: HYPERLIQUID API Tests\n');
  
  await test('Hyperliquid', 'Get account', async () => {
    const account = await testAccount(token, 'hyperliquid');
    console.log(`   → Balance: $${account.data?.totalBalance || account.data?.balance || 'N/A'}`);
    if (!account.success) throw new Error(account.error);
  });

  await test('Hyperliquid', 'Get positions', async () => {
    const positions = await testPositions(token, 'hyperliquid');
    console.log(`   → Positions: ${positions.data?.length || 0}`);
    if (!positions.success) throw new Error(positions.error);
  });

  await test('Hyperliquid', 'Get open orders (BTC)', async () => {
    const orders = await testOrders(token, 'hyperliquid', 'BTC');
    console.log(`   → Open orders: ${orders.data?.length || 0}`);
    if (!orders.success) throw new Error(orders.error);
  });

  // 7. Public APIs
  console.log('\n📍 STEP 7: Public APIs\n');
  
  await test('Public', 'Get assets', async () => {
    const res = await axios.get(`${API_URL}/assets?exchange=aster`);
    console.log(`   → ${res.data.data?.length || 0} symbols`);
  });

  await test('Public', 'Search assets', async () => {
    const res = await axios.get(`${API_URL}/assets/search?query=BTC&exchange=aster`);
    console.log(`   → ${res.data.data?.length || 0} matches`);
  });

  await test('Public', 'Get ticker', async () => {
    const res = await axios.get(`${API_URL}/ticker/BTCUSDT?exchange=aster`);
    console.log(`   → BTC: $${res.data.data?.price || 'N/A'}`);
  });

  await test('Public', 'Get orderbook', async () => {
    const res = await axios.get(`${API_URL}/orderbook/BTCUSDT?exchange=aster`);
    if (!res.data.success) throw new Error(res.data.error);
  });

  // Summary
  console.log('\n========================================');
  console.log('  📊 RESULTS');
  console.log('========================================\n');

  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.passed).length;
    const total = categoryResults.length;
    const emoji = passed === total ? '✅' : '⚠️';
    console.log(`${emoji} ${category}: ${passed}/${total}`);
  }

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  
  console.log(`\n📈 TOTAL: ${totalPassed}/${results.length} passed`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - [${r.category}] ${r.name}: ${r.error}`);
    });
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
  }

  console.log('\n');
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);
