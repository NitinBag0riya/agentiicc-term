#!/usr/bin/env bun

/**
 * API Test Script
 * Demonstrates how to use the /account endpoint
 */

const API_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing AgentiFi API\n');

  // Test 1: Health Check
  console.log('1️⃣ Testing health endpoint...');
  const healthRes = await fetch(`${API_URL}/health`);
  const health = await healthRes.json();
  console.log('✅ Health:', health);
  console.log('');

  // Test 2: Create Session (you'll need a real userId from your database)
  console.log('2️⃣ Creating session...');
  const sessionRes = await fetch(`${API_URL}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 1,  // Change to your actual user ID
      exchangeId: 'aster'  // or 'hyperliquid'
    })
  });
  const sessionData = await sessionRes.json();
  console.log('Session:', sessionData);
  console.log('');

  if (!sessionData.success) {
    console.log('❌ Failed to create session. Make sure:');
    console.log('   - You have linked an exchange via /link in the bot');
    console.log('   - The userId exists in the database');
    return;
  }

  const token = sessionData.token;

  // Test 3: Get Account Info
  console.log('3️⃣ Fetching account info...');
  const accountRes = await fetch(`${API_URL}/account`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const accountData = await accountRes.json();
  console.log('Account Data:', JSON.stringify(accountData, null, 2));
  console.log('');

  // Test 4: Try unauthorized access
  console.log('4️⃣ Testing unauthorized access...');
  const unauthorizedRes = await fetch(`${API_URL}/account`);
  const unauthorizedData = await unauthorizedRes.json();
  console.log('Unauthorized:', unauthorizedData);
  console.log('');

  // Test 5: Logout
  console.log('5️⃣ Logging out...');
  const logoutRes = await fetch(`${API_URL}/auth/session`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const logoutData = await logoutRes.json();
  console.log('Logout:', logoutData);
  console.log('');

  console.log('✅ All tests completed!');
}

testAPI().catch(console.error);
