#!/usr/bin/env bun

/**
 * Comprehensive API Test Suite
 * Tests all unified trading endpoints
 */

const API_URL = 'http://localhost:3000';
let sessionToken = '';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(title: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${title}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

async function testEndpoint(name: string, fn: () => Promise<any>) {
  try {
    info(`Testing: ${name}`);
    const result = await fn();
    success(`${name} - PASSED`);
    return result;
  } catch (err: any) {
    error(`${name} - FAILED: ${err.message}`);
    return null;
  }
}

async function runTests() {
  log('\n🚀 Starting Unified Trading API Tests\n', colors.yellow);

  // ============ HEALTH CHECK ============
  section('Health Check');
  
  await testEndpoint('GET /health', async () => {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();
    console.log('   Response:', data);
    if (data.status !== 'ok') throw new Error('Health check failed');
    return data;
  });

  // ============ AUTHENTICATION ============
  section('Authentication');
  
  const session = await testEndpoint('POST /auth/session', async () => {
    const res = await fetch(`${API_URL}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        exchangeId: 'aster'
      })
    });
    const data = await res.json();
    console.log('   Response:', data);
    
    if (!data.success || !data.token) {
      throw new Error('Failed to create session');
    }
    
    sessionToken = data.token;
    return data;
  });

  if (!sessionToken) {
    error('Cannot continue without session token');
    return;
  }

  // ============ ACCOUNT ============
  section('Account Operations');
  
  await testEndpoint('GET /account', async () => {
    const res = await fetch(`${API_URL}/account`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const data = await res.json();
    console.log('   Balance:', data.data?.totalBalance);
    console.log('   Positions:', data.data?.positions?.length || 0);
    return data;
  });

  // ============ MARKET DATA (PUBLIC) ============
  section('Market Data (Public)');
  
  await testEndpoint('GET /assets (Aster)', async () => {
    const res = await fetch(`${API_URL}/assets?exchange=aster`);
    const data = await res.json();
    console.log('   Assets count:', data.data?.length || 0);
    if (data.data?.length > 0) {
      console.log('   First asset:', data.data[0].symbol);
    }
    return data;
  });

  await testEndpoint('GET /assets (Hyperliquid)', async () => {
    const res = await fetch(`${API_URL}/assets?exchange=hyperliquid`);
    const data = await res.json();
    console.log('   Assets count:', data.data?.length || 0);
    if (data.data?.length > 0) {
      console.log('   First asset:', data.data[0].symbol);
    }
    return data;
  });

  await testEndpoint('GET /assets/search?q=BTC', async () => {
    const res = await fetch(`${API_URL}/assets/search?q=BTC`);
    const data = await res.json();
    console.log('   Results:', data.count);
    if (data.data?.length > 0) {
      console.log('   First result:', data.data[0].symbol, `(${data.data[0].exchange})`);
    }
    return data;
  });

  await testEndpoint('GET /ticker/BTCUSDT', async () => {
    const res = await fetch(`${API_URL}/ticker/BTCUSDT`);
    const data = await res.json();
    console.log('   Price:', data.data?.price);
    return data;
  });

  await testEndpoint('GET /orderbook/BTCUSDT', async () => {
    const res = await fetch(`${API_URL}/orderbook/BTCUSDT?depth=5`);
    const data = await res.json();
    console.log('   Bids:', data.data?.bids?.length || 0);
    console.log('   Asks:', data.data?.asks?.length || 0);
    return data;
  });

  // ============ ORDERS ============
  section('Order Operations');
  
  await testEndpoint('GET /orders (Open Orders)', async () => {
    const res = await fetch(`${API_URL}/orders`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const data = await res.json();
    console.log('   Open orders:', data.data?.length || 0);
    return data;
  });

  await testEndpoint('GET /orders/history', async () => {
    const res = await fetch(`${API_URL}/orders/history?limit=10`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const data = await res.json();
    console.log('   Historical orders:', data.data?.length || 0);
    return data;
  });

  // Note: Skipping actual order placement to avoid real trades
  info('Skipping POST /order (would place real trade)');
  info('Skipping DELETE /order/:id (no test orders)');

  // ============ POSITIONS ============
  section('Position Operations');
  
  await testEndpoint('GET /positions', async () => {
    const res = await fetch(`${API_URL}/positions`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const data = await res.json();
    console.log('   Open positions:', data.data?.length || 0);
    if (data.data?.length > 0) {
      console.log('   First position:', data.data[0].symbol, data.data[0].side);
    }
    return data;
  });

  // ============ CLEANUP ============
  section('Cleanup');
  
  await testEndpoint('DELETE /auth/session', async () => {
    const res = await fetch(`${API_URL}/auth/session`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const data = await res.json();
    console.log('   Response:', data);
    return data;
  });

  // ============ SUMMARY ============
  section('Test Summary');
  
  log('\n✨ All tests completed!', colors.green);
  log('\nNote: Order placement and cancellation were skipped to avoid real trades.', colors.yellow);
  log('To test those endpoints, use the API documentation with test credentials.\n', colors.yellow);
}

// Run tests
runTests().catch((err) => {
  error(`Test suite failed: ${err.message}`);
  process.exit(1);
});
