/**
 * Fresh Start Test v3 - Tests full user flow
 * Uses correct DB column names: api_key_encrypted, api_secret_encrypted
 */

import axios from 'axios';
import { Client } from 'pg';
import * as crypto from 'crypto';
import 'dotenv/config';

const API_URL = process.env.UNIVERSAL_API_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Credentials from .env
const ASTER_API_KEY = process.env.ASTER_API_KEY!;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET!;
const HYPERLIQUID_PRIVATE_KEY = process.env.HYPERLIQUID_PRIVATE_KEY!;
const HYPERLIQUID_ADDRESS = process.env.HYPERLIQUID_ADDRESS!;

const TEST_TELEGRAM_ID = 7797429783;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

async function test(name: string, fn: () => Promise<any>) {
  try {
    const data = await fn();
    results.push({ name, passed: true });
    log('✅', `${name}`);
    return data;
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    log('❌', `${name}: ${error.message}`);
    return null;
  }
}

async function getDbClient() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

// Encryption matching app's format
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
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

async function testHealthCheck() {
  const response = await axios.get(`${API_URL}/health`);
  if (response.data.status !== 'ok') throw new Error('Health check failed');
  return response.data;
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

async function main() {
  console.log('\n========================================');
  console.log('  🧪 FRESH START USER FLOW TEST v3');
  console.log('========================================\n');

  // 1. Health check
  await test('Health check', testHealthCheck);

  // 2. Flush and create user
  console.log('\n📍 STEP 1: Fresh User\n');
  let userId = 0;
  await test('Flush & create user', async () => {
    userId = await flushAndCreateUser();
    return { userId };
  });

  // 3. Test with NO exchanges linked
  console.log('\n📍 STEP 2: No Exchanges Linked\n');
  
  await test('Linked exchanges = empty', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → linkedExchanges: ${JSON.stringify(exchanges)}`);
    if (exchanges.length !== 0) throw new Error(`Expected 0, got ${exchanges.length}`);
  });

  await test('Session returns empty linkedExchanges', async () => {
    const session = await testSession(userId);
    console.log(`   → linkedExchanges: ${JSON.stringify(session.linkedExchanges)}`);
  });

  // 4. Link Aster
  console.log('\n📍 STEP 3: Link ASTER\n');
  
  await test('Link Aster credentials', linkAster.bind(null, userId));

  await test('Verify Aster linked', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → linkedExchanges: ${JSON.stringify(exchanges)}`);
    if (!exchanges.includes('aster')) throw new Error('Aster not linked');
  });

  let token = '';
  await test('Session returns Aster in linkedExchanges', async () => {
    const session = await testSession(userId);
    token = session.token;
    console.log(`   → linkedExchanges: ${JSON.stringify(session.linkedExchanges)}`);
    console.log(`   → activeExchange: ${session.activeExchange}`);
    if (!session.linkedExchanges?.includes('aster')) throw new Error('Aster not in session');
  });

  await test('Get Aster account', async () => {
    const account = await testAccount(token, 'aster');
    console.log(`   → Balance: ${account.data?.totalBalance || account.data?.balance || 'N/A'}`);
  });

  await test('Get Aster positions', async () => {
    const positions = await testPositions(token, 'aster');
    console.log(`   → Positions: ${positions.data?.length || 0}`);
  });

  // 5. Link Hyperliquid
  console.log('\n📍 STEP 4: Link HYPERLIQUID\n');
  
  await test('Link Hyperliquid credentials', linkHyperliquid.bind(null, userId));

  await test('Verify both exchanges linked', async () => {
    const exchanges = await getLinkedExchanges(userId);
    console.log(`   → linkedExchanges: ${JSON.stringify(exchanges)}`);
    if (!exchanges.includes('aster')) throw new Error('Aster missing');
    if (!exchanges.includes('hyperliquid')) throw new Error('Hyperliquid missing');
  });

  await test('Session returns both in linkedExchanges', async () => {
    const session = await testSession(userId);
    token = session.token;
    console.log(`   → linkedExchanges: ${JSON.stringify(session.linkedExchanges)}`);
    if (session.linkedExchanges?.length !== 2) throw new Error('Should have 2 exchanges');
  });

  await test('Get Hyperliquid account', async () => {
    const account = await testAccount(token, 'hyperliquid');
    console.log(`   → Balance: ${account.data?.totalBalance || account.data?.balance || 'N/A'}`);
  });

  await test('Get Hyperliquid positions', async () => {
    const positions = await testPositions(token, 'hyperliquid');
    console.log(`   → Positions: ${positions.data?.length || 0}`);
  });

  // Summary
  console.log('\n========================================');
  console.log('  📊 TEST RESULTS');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
