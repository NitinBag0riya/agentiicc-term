/**
 * Practical Integration Test - Tests the ACTUAL running bot and API
 */
import axios from 'axios';

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TEST_USER_ID = process.env.TEST_USER_ID || '123456789';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Test API endpoints
 */
async function testAPI() {
  console.log('\n🌐 Testing API Endpoints...\n');
  
  // Test 1: Health check
  await runTest('API Health Check', async () => {
    const response = await axios.get(`${API_BASE}/health`);
    if (response.status !== 200) throw new Error('Health check failed');
  });
  
  // Test 2: Get assets
  await runTest('Get Assets', async () => {
    const response = await axios.get(`${API_BASE}/assets?exchange=aster`);
    if (!response.data) throw new Error('No assets returned');
  });
  
  // Test 3: Search assets
  await runTest('Search Assets (BTC)', async () => {
    const response = await axios.get(`${API_BASE}/assets/search?q=BTC`);
    if (!response.data || response.data.length === 0) {
      throw new Error('No BTC assets found');
    }
  });
  
  // Test 4: Get account (requires session)
  await runTest('Get Account Info', async () => {
    try {
      const response = await axios.get(`${API_BASE}/account`, {
        params: { userId: TEST_USER_ID, exchange: 'aster' }
      });
      // May fail if not linked, that's ok
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        // Expected if user not linked
        return;
      }
      throw err;
    }
  });
}

/**
 * Test bot commands via Telegram API
 */
async function testBotCommands() {
  console.log('\n🤖 Testing Bot Commands...\n');
  
  if (!BOT_TOKEN) {
    console.log('⚠️  BOT_TOKEN not set, skipping bot tests');
    return;
  }
  
  const telegramAPI = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  // Test 1: Get bot info
  await runTest('Get Bot Info', async () => {
    const response = await axios.get(`${telegramAPI}/getMe`);
    if (!response.data.ok) throw new Error('Failed to get bot info');
    console.log(`   Bot: @${response.data.result.username}`);
  });
  
  // Test 2: Get webhook info
  await runTest('Get Webhook Info', async () => {
    const response = await axios.get(`${telegramAPI}/getWebhookInfo`);
    if (!response.data.ok) throw new Error('Failed to get webhook info');
    const info = response.data.result;
    console.log(`   Webhook: ${info.url || 'Not set'}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);
  });
}

/**
 * Test critical bot screens
 */
async function testBotScreens() {
  console.log('\n📱 Testing Bot Screens (Manual Verification Required)...\n');
  
  console.log('Please manually test these screens in Telegram:');
  console.log('  1. Send /start to the bot');
  console.log('  2. Click "Menu" button');
  console.log('  3. Click "Citadel" to view overview');
  console.log('  4. Click "Positions" to view positions');
  console.log('  5. Click on a position to manage it');
  console.log('  6. Try setting TP/SL');
  console.log('  7. Try changing leverage');
  console.log('  8. Try managing margin\n');
  
  console.log('✅ Manual testing checklist created');
}

/**
 * Run a single test
 */
async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: error.message, duration });
    console.log(`  ❌ ${name}: ${error.message} (${duration}ms)`);
  }
}

/**
 * Generate summary
 */
function generateSummary() {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  
  console.log('\n\n📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Pass Rate: ${passRate}%`);
  console.log('═'.repeat(60));
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n');
}

/**
 * Main test runner
 */
async function main() {
  console.log('🚀 AgentiFi Integration Tests');
  console.log('═'.repeat(60));
  console.log(`API Base: ${API_BASE}`);
  console.log(`Bot Token: ${BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
  console.log(`Test User ID: ${TEST_USER_ID}`);
  console.log('═'.repeat(60));
  
  // Check if services are running
  console.log('\n🔍 Checking Services...\n');
  
  try {
    await axios.get(`${API_BASE}/health`, { timeout: 2000 });
    console.log('  ✅ API Server is running');
  } catch (err) {
    console.log('  ❌ API Server is NOT running');
    console.log('     Start it with: bun src/server-bun.ts\n');
    process.exit(1);
  }
  
  // Run tests
  await testAPI();
  await testBotCommands();
  await testBotScreens();
  
  // Summary
  generateSummary();
  
  // Exit code
  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run
main().catch(console.error);
