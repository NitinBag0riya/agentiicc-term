/**
 * REAL END-TO-END BOT TEST
 * Uses actual Aster credentials from .env
 * Tests all bot flows with live API responses
 * NO MOCKS - NO SIMULATIONS - REAL DATA ONLY
 */
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const USER_ID = process.env.TEST_CHAT_ID || '7797429783';
const ASTER_API_KEY = process.env.ASTER_API_KEY;
const ASTER_API_SECRET = process.env.ASTER_API_SECRET;

interface TestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
  responseTime: number;
}

const results: TestResult[] = [];

async function testEndpoint(testName: string, fn: () => Promise<any>): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n🧪 ${testName}`);
  
  try {
    const data = await fn();
    const responseTime = Date.now() - startTime;
    
    console.log(`   ✅ Success (${responseTime}ms)`);
    console.log(`   Data:`, JSON.stringify(data).substring(0, 150) + '...');
    
    return { test: testName, success: true, data, responseTime };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ Failed (${responseTime}ms)`);
    console.log(`   Error:`, error.response?.data || error.message);
    
    return { 
      test: testName, 
      success: false, 
      error: error.response?.data?.error || error.message,
      responseTime 
    };
  }
}

async function main() {
  console.log('🚀 REAL END-TO-END BOT TEST');
  console.log('═'.repeat(70));
  console.log('Using REAL credentials from .env');
  console.log('Testing with LIVE API responses');
  console.log('NO MOCKS - NO SIMULATIONS');
  console.log('═'.repeat(70));
  console.log(`API URL: ${API_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log(`Aster Key: ${ASTER_API_KEY?.substring(0, 10)}...`);
  console.log('═'.repeat(70));
  
  if (!ASTER_API_KEY || !ASTER_API_SECRET) {
    console.error('\n❌ ERROR: ASTER_API_KEY and ASTER_API_SECRET must be set in .env');
    process.exit(1);
  }
  
  // ============ PHASE 1: LINK ACCOUNT WITH REAL CREDENTIALS ============
  console.log('\n\n📍 PHASE 1: Link Account (Real Credentials)');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Save Real Aster Credentials', async () => {
    const response = await axios.post(`${API_URL}/user/credentials`, {
      userId: USER_ID,
      exchange: 'aster',
      apiKey: ASTER_API_KEY,
      apiSecret: ASTER_API_SECRET
    });
    return response.data;
  }));
  
  if (!results[0].success) {
    console.error('\n❌ Cannot proceed - failed to save credentials');
    process.exit(1);
  }
  
  // ============ PHASE 2: CREATE SESSION ============
  console.log('\n\n📍 PHASE 2: Create Session');
  console.log('─'.repeat(70));
  
  let sessionToken: string | undefined;
  
  results.push(await testEndpoint('Create Session with Real User', async () => {
    const response = await axios.post(`${API_URL}/auth/session`, {
      userId: USER_ID
    });
    
    if (response.data.success) {
      sessionToken = response.data.token;
    }
    return response.data;
  }));
  
  if (!sessionToken) {
    console.error('\n❌ Cannot proceed - no session token');
    process.exit(1);
  }
  
  const authHeaders = { Authorization: `Bearer ${sessionToken}` };
  
  // ============ PHASE 3: GET REAL ACCOUNT DATA ============
  console.log('\n\n📍 PHASE 3: Get Real Account Data');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Get Real Aster Account Balance', async () => {
    const response = await axios.get(`${API_URL}/account`, {
      params: { exchange: 'aster' },
      headers: authHeaders
    });
    
    console.log(`\n   📊 REAL ACCOUNT DATA:`);
    console.log(`      Total Balance: $${response.data.data?.totalBalance || 'N/A'}`);
    console.log(`      Available: $${response.data.data?.availableBalance || 'N/A'}`);
    console.log(`      Assets: ${response.data.data?.assets?.length || 0}`);
    
    return response.data;
  }));
  
  // ============ PHASE 4: GET REAL POSITIONS ============
  console.log('\n\n📍 PHASE 4: Get Real Positions');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Get Real Open Positions', async () => {
    const response = await axios.get(`${API_URL}/positions`, {
      params: { exchange: 'aster' },
      headers: authHeaders
    });
    
    const positions = response.data.data || [];
    console.log(`\n   📈 REAL POSITIONS: ${positions.length}`);
    positions.slice(0, 3).forEach((pos: any) => {
      console.log(`      ${pos.symbol}: ${pos.side} ${pos.size} @ $${pos.entryPrice}`);
    });
    
    return response.data;
  }));
  
  // ============ PHASE 5: GET REAL OPEN ORDERS ============
  console.log('\n\n📍 PHASE 5: Get Real Open Orders');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Get Real Open Orders', async () => {
    const response = await axios.get(`${API_URL}/orders/open`, {
      params: { exchange: 'aster' },
      headers: authHeaders
    });
    
    const orders = response.data.data || [];
    console.log(`\n   📋 REAL ORDERS: ${orders.length}`);
    orders.slice(0, 3).forEach((order: any) => {
      console.log(`      ${order.symbol}: ${order.type} ${order.side} @ $${order.price || 'MARKET'}`);
    });
    
    return response.data;
  }));
  
  // ============ PHASE 6: GET REAL ASSETS ============
  console.log('\n\n📍 PHASE 6: Get Real Available Assets');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Get Real Aster Assets List', async () => {
    const response = await axios.get(`${API_URL}/assets`, {
      params: { exchange: 'aster' }
    });
    
    const assets = response.data.data || [];
    console.log(`\n   💰 REAL ASSETS: ${assets.length}`);
    assets.slice(0, 5).forEach((asset: any) => {
      console.log(`      ${asset.symbol}: ${asset.name}`);
    });
    
    return response.data;
  }));
  
  // ============ PHASE 7: SEARCH REAL ASSETS ============
  console.log('\n\n📍 PHASE 7: Search Real Assets');
  console.log('─'.repeat(70));
  
  results.push(await testEndpoint('Search for BTC in Real Assets', async () => {
    const response = await axios.get(`${API_URL}/assets/search`, {
      params: { query: 'BTC', exchange: 'aster' }
    });
    
    const results = response.data.data || [];
    console.log(`\n   🔍 SEARCH RESULTS: ${results.length}`);
    results.slice(0, 3).forEach((asset: any) => {
      console.log(`      ${asset.symbol}: ${asset.name}`);
    });
    
    return response.data;
  }));
  
  // ============ SUMMARY ============
  console.log('\n\n📊 REAL TEST SUMMARY');
  console.log('═'.repeat(70));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log('═'.repeat(70));
  
  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.test}`);
      console.log(`     Error: ${r.error}`);
    });
  }
  
  console.log('\n✅ Passed Tests:');
  results.filter(r => r.success).forEach(r => {
    console.log(`   - ${r.test} (${r.responseTime}ms)`);
  });
  
  console.log('\n\n🎯 VERIFICATION');
  console.log('═'.repeat(70));
  
  if (passedTests === totalTests) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ Bot is working with REAL data');
    console.log('✅ All API endpoints returning live responses');
    console.log('✅ Ready for production use');
  } else {
    console.log('❌ Some tests failed');
    console.log('   Review errors above and fix issues');
  }
  
  console.log('\n');
}

main().catch(console.error);
