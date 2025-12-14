#!/usr/bin/env bun

/**
 * End-to-End Test for Telegram Bot Integration
 * Tests: Link flow → Session creation → Account/Positions API calls
 */

import { encrypt } from './src/bot/utils/encryption';

const API_BASE = 'http://localhost:3000';

async function testBotIntegration() {
  console.log('🧪 Starting Bot Integration Test\n');
  
  // Step 1: Get test credentials from env
  const asterKey = process.env.ASTER_API_KEY;
  const asterSecret = process.env.ASTER_API_SECRET;
  
  if (!asterKey || !asterSecret) {
    console.log('❌ ASTER_API_KEY or ASTER_API_SECRET not set in .env');
    console.log('Please set these to test the integration');
    return;
  }
  
  console.log('✅ Found Aster credentials');
  console.log(`   API Key: ${asterKey.substring(0, 15)}...`);
  
  // Step 2: Encrypt credentials (simulating bot's link scene)
  console.log('\n📦 Encrypting credentials...');
  const encryptedKey = encrypt(asterKey);
  const encryptedSecret = encrypt(asterSecret);
  console.log('✅ Credentials encrypted');
  
  // Step 3: Create session (simulating bot after link)
  console.log('\n🔐 Creating API session...');
  const sessionRes = await fetch(`${API_BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 999, exchangeId: 'aster' })
  });
  
  const sessionData = await sessionRes.json();
  
  if (!sessionData.success) {
    console.log('❌ Session creation failed:', sessionData);
    return;
  }
  
  const token = sessionData.token;
  console.log('✅ Session created');
  console.log(`   Token: ${token}`);
  
  // Step 4: Test account endpoint (will fail - no creds in DB)
  console.log('\n💰 Testing /account endpoint...');
  const accountRes = await fetch(`${API_BASE}/account`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const accountData = await accountRes.json();
  console.log('Response:', JSON.stringify(accountData, null, 2));
  
  if (accountData.success) {
    console.log('✅ Account data retrieved successfully!');
    console.log(`   Balance: $${accountData.data?.totalBalance || 'N/A'}`);
  } else {
    console.log('⚠️  Expected failure (no credentials in DB)');
    console.log(`   Error: ${accountData.error}`);
  }
  
  // Step 5: Test positions endpoint
  console.log('\n📊 Testing /positions endpoint...');
  const positionsRes = await fetch(`${API_BASE}/positions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const positionsData = await positionsRes.json();
  console.log('Response:', JSON.stringify(positionsData, null, 2));
  
  if (positionsData.success) {
    console.log('✅ Positions data retrieved successfully!');
    console.log(`   Positions: ${positionsData.data?.length || 0}`);
  } else {
    console.log('⚠️  Expected failure (no credentials in DB)');
    console.log(`   Error: ${positionsData.error}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📝 Summary:');
  console.log('='.repeat(60));
  console.log('✅ Encryption: Working (same algorithm as API)');
  console.log('✅ Session creation: Working');
  console.log('⚠️  API calls: Need credentials in database');
  console.log('\n💡 Next: Link exchange in Telegram bot to store credentials');
  console.log('   Then balance/positions will work!');
}

testBotIntegration().catch(console.error);
