/**
 * Comprehensive API Test Script
 * Tests ALL bot APIs across both Aster and Hyperliquid exchanges
 * 
 * Run with: npx ts-node test-all-apis.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { UniversalApiClient } from './src/services/universalApi';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Test configuration
const TEST_CONFIG = {
  USER_ID: 3, // Update with your test user ID
  SYMBOL: 'BTCUSDT',
  HL_SYMBOL: 'BTC', // Hyperliquid uses different symbol format
  TEST_QTY: '0.001', // Small test quantity
  TEST_PRICE: '50000', // Test limit price (far from market)
  TEST_LEVERAGE: 10,
};

interface TestResult {
  test: string;
  exchange: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function addResult(test: string, exchange: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string) {
  results.push({ test, exchange, status, message });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  log(`${emoji} [${exchange.toUpperCase()}] ${test}: ${message}`);
}

async function testAccountInfo(client: UniversalApiClient, exchange: string) {
  const testName = 'Account Info';
  try {
    const result = await client.getAccount(exchange);
    if (result.success) {
      addResult(testName, exchange, 'PASS', `Balance: ${result.data?.totalBalance || 'N/A'}`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testPositions(client: UniversalApiClient, exchange: string) {
  const testName = 'Get Positions';
  try {
    const result = await client.getPositions(exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} positions found`);
      return result.data;
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
  return [];
}

async function testOpenOrders(client: UniversalApiClient, exchange: string) {
  const testName = 'Get Open Orders';
  try {
    const result = await client.getOpenOrders(undefined, exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} open orders`);
      return result.data;
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
  return [];
}

async function testTicker(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Get Ticker';
  try {
    const result = await client.getTicker(symbol, exchange);
    if (result.success) {
      addResult(testName, exchange, 'PASS', `Price: ${result.data?.price || result.data?.lastPrice || 'N/A'}`);
      return result.data;
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
  return null;
}

async function testAssets(client: UniversalApiClient, exchange: string) {
  const testName = 'Get Assets';
  try {
    const result = await client.getAssets(exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} assets available`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testOrderbook(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Get Orderbook';
  try {
    const result = await client.getOrderbook(symbol, exchange);
    if (result.success) {
      const bids = result.data?.bids?.length || 0;
      const asks = result.data?.asks?.length || 0;
      addResult(testName, exchange, 'PASS', `${bids} bids, ${asks} asks`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testOrderHistory(client: UniversalApiClient, exchange: string) {
  const testName = 'Get Order History';
  try {
    const result = await client.getOrderHistory(undefined, 10, exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} historical orders`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testFills(client: UniversalApiClient, exchange: string) {
  const testName = 'Get Fills';
  try {
    const result = await client.getFills(undefined, 10, exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} fills`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testSetLeverage(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Set Leverage';
  try {
    const result = await client.setLeverage(symbol, TEST_CONFIG.TEST_LEVERAGE, exchange);
    if (result.success) {
      addResult(testName, exchange, 'PASS', `Set to ${TEST_CONFIG.TEST_LEVERAGE}x`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testLimitOrder(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Place Limit Order';
  try {
    // Get current price to place order far from market
    const ticker = await client.getTicker(symbol, exchange);
    const currentPrice = parseFloat(ticker.data?.price || ticker.data?.lastPrice || '50000');
    const limitPrice = (currentPrice * 0.5).toFixed(2); // 50% below market (won't fill)

    const result = await client.placeOrder({
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity: TEST_CONFIG.TEST_QTY,
      price: limitPrice,
      exchange
    });

    if (result.success) {
      addResult(testName, exchange, 'PASS', `Order ID: ${result.data?.orderId}`);
      return result.data?.orderId;
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
  return null;
}

async function testCancelOrder(client: UniversalApiClient, exchange: string, orderId: string, symbol: string) {
  const testName = 'Cancel Order';
  if (!orderId) {
    addResult(testName, exchange, 'SKIP', 'No order to cancel');
    return;
  }
  try {
    const result = await client.cancelOrder(orderId, symbol);
    if (result.success) {
      addResult(testName, exchange, 'PASS', 'Order cancelled');
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testCancelAllOrders(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Cancel All Orders';
  try {
    const result = await client.cancelAllOrders(symbol, exchange);
    if (result.success) {
      addResult(testName, exchange, 'PASS', result.data?.message || 'Orders cancelled');
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function testOHLCV(client: UniversalApiClient, exchange: string, symbol: string) {
  const testName = 'Get OHLCV';
  try {
    const result = await client.getOHLCV(symbol, '15m', 100, exchange);
    if (result.success) {
      const count = result.data?.length || 0;
      addResult(testName, exchange, 'PASS', `${count} candles`);
    } else {
      addResult(testName, exchange, 'FAIL', result.error || 'Unknown error');
    }
  } catch (e: any) {
    addResult(testName, exchange, 'FAIL', e.message);
  }
}

async function runExchangeTests(client: UniversalApiClient, exchange: string) {
  log(`\n${'='.repeat(60)}`);
  log(`📡 TESTING EXCHANGE: ${exchange.toUpperCase()}`);
  log(`${'='.repeat(60)}`);

  const symbol = exchange === 'hyperliquid' ? TEST_CONFIG.HL_SYMBOL : TEST_CONFIG.SYMBOL;

  // 1. Read-only tests
  log('\n📖 READ-ONLY TESTS');
  log('-'.repeat(40));

  await testAccountInfo(client, exchange);
  await testPositions(client, exchange);
  await testOpenOrders(client, exchange);
  await testTicker(client, exchange, symbol);
  await testAssets(client, exchange);
  await testOrderbook(client, exchange, symbol);
  await testOrderHistory(client, exchange);
  await testFills(client, exchange);
  await testOHLCV(client, exchange, symbol);

  // 2. Write tests (with cleanup)
  log('\n📝 WRITE TESTS (with cleanup)');
  log('-'.repeat(40));

  // Set leverage
  await testSetLeverage(client, exchange, symbol);

  // Place and cancel a limit order
  const orderId = await testLimitOrder(client, exchange, symbol);
  if (orderId) {
    // Small delay to ensure order is registered
    await new Promise(r => setTimeout(r, 1000));
    await testCancelOrder(client, exchange, orderId, symbol);
  }

  // Cancel all orders (cleanup)
  await testCancelAllOrders(client, exchange, symbol);
}

async function printSummary() {
  log('\n' + '='.repeat(60));
  log('📊 TEST SUMMARY');
  log('='.repeat(60));

  const asterResults = results.filter(r => r.exchange === 'aster');
  const hlResults = results.filter(r => r.exchange === 'hyperliquid');

  const countResults = (arr: TestResult[]) => ({
    pass: arr.filter(r => r.status === 'PASS').length,
    fail: arr.filter(r => r.status === 'FAIL').length,
    skip: arr.filter(r => r.status === 'SKIP').length,
  });

  const asterStats = countResults(asterResults);
  const hlStats = countResults(hlResults);
  const totalStats = countResults(results);

  console.log('\n┌──────────────────┬──────┬──────┬──────┐');
  console.log('│ Exchange         │ PASS │ FAIL │ SKIP │');
  console.log('├──────────────────┼──────┼──────┼──────┤');
  console.log(`│ Aster DEX        │  ${String(asterStats.pass).padStart(2)}  │  ${String(asterStats.fail).padStart(2)}  │  ${String(asterStats.skip).padStart(2)}  │`);
  console.log(`│ Hyperliquid      │  ${String(hlStats.pass).padStart(2)}  │  ${String(hlStats.fail).padStart(2)}  │  ${String(hlStats.skip).padStart(2)}  │`);
  console.log('├──────────────────┼──────┼──────┼──────┤');
  console.log(`│ TOTAL            │  ${String(totalStats.pass).padStart(2)}  │  ${String(totalStats.fail).padStart(2)}  │  ${String(totalStats.skip).padStart(2)}  │`);
  console.log('└──────────────────┴──────┴──────┴──────┘');

  // List failures
  const failures = results.filter(r => r.status === 'FAIL');
  if (failures.length > 0) {
    log('\n❌ FAILURES:');
    failures.forEach(f => {
      log(`  - [${f.exchange.toUpperCase()}] ${f.test}: ${f.message}`);
    });
  }
}

async function main() {
  log('🚀 Starting Comprehensive API Test Suite');
  log(`Test User ID: ${TEST_CONFIG.USER_ID}`);
  log(`Test Symbol: ${TEST_CONFIG.SYMBOL}`);

  const client = new UniversalApiClient();

  // Initialize session
  log('\n🔑 Initializing API Session...');
  const initSuccess = await client.initSession(TEST_CONFIG.USER_ID);
  if (!initSuccess) {
    log('❌ Failed to initialize session. Ensure the user exists and has credentials linked.');
    process.exit(1);
  }
  log('✅ Session initialized');

  // Run tests for each exchange
  await runExchangeTests(client, 'aster');
  await runExchangeTests(client, 'hyperliquid');

  // Print summary
  await printSummary();

  log('\n🏁 Test Suite Complete');
}

main().catch(console.error);
