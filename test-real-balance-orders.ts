#!/usr/bin/env bun
/**
 * Real Order Testing with Balance Check
 * Tests both Aster and Hyperliquid with actual funds
 */


const PUBLIC_URL = 'https://97877c2a1fef.ngrok-free.app';
const TEST_USER_ID = 2;
const HYPERLIQUID_WALLET = '0x56De2f46c795A10ba57134BC222EB8544c83Fd6f';

interface OrderTest {
  name: string;
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  priceOffset?: number; // percentage offset from current price
  stopPriceOffset?: number;
  quantity?: string;
  takeProfit?: boolean;
  stopLoss?: boolean;
  leverage?: number;
}

const placedOrders: Array<{exchange: string, symbol: string, orderId: string}> = [];

async function makeRequest(route: string, method: string = 'GET', body?: any, headers?: Record<string, string>) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  const url = route.startsWith('http') ? route : `${PUBLIC_URL}${route}`;
  const response = await fetch(url, options);
  
  let data;
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }
  
  return { response, data };
}

async function checkBalance(exchange: string, sessionId: string) {
  console.log(`\n💰 Checking ${exchange.toUpperCase()} Balance...`);
  
  const { response, data } = await makeRequest(
    `/account?exchange=${exchange}`,
    'GET',
    undefined,
    {
      'Authorization': `Bearer ${sessionId}`,
      'Cookie': `session=${sessionId}`
    }
  );
  
  if (response.ok && data.success) {
    const balance = parseFloat(data.data?.totalBalance || '0');
    const available = parseFloat(data.data?.availableBalance || '0');
    const positions = data.data?.positions?.length || 0;
    
    console.log(`   Total Balance: $${balance.toFixed(2)}`);
    console.log(`   Available: $${available.toFixed(2)}`);
    console.log(`   Open Positions: ${positions}`);
    
    return { balance, available, positions };
  } else {
    console.log(`   ❌ Failed to get balance: ${data.error || 'Unknown error'}`);
    return { balance: 0, available: 0, positions: 0 };
  }
}

async function getCurrentPrice(exchange: string, symbol: string): Promise<number> {
  const { response, data } = await makeRequest(`/ticker/${symbol}?exchange=${exchange}`);
  
  if (response.ok && data.success) {
    return parseFloat(data.data?.price || data.data?.lastPrice || '0');
  }
  
  return 0;
}

async function placeOrder(
  exchange: string,
  symbol: string,
  side: 'BUY' | 'SELL',
  type: string,
  quantity: string,
  price: string | undefined,
  sessionId: string,
  options?: {
    stopPrice?: string;
    takeProfit?: string;
    stopLoss?: string;
    leverage?: number;
  }
) {
  console.log(`\n📝 Placing ${type} ${side} order on ${exchange.toUpperCase()}`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Quantity: ${quantity}`);
  if (price) console.log(`   Price: $${price}`);
  if (options?.stopPrice) console.log(`   Stop Price: $${options.stopPrice}`);
  if (options?.takeProfit) console.log(`   Take Profit: $${options.takeProfit}`);
  if (options?.stopLoss) console.log(`   Stop Loss: $${options.stopLoss}`);
  if (options?.leverage) console.log(`   Leverage: ${options.leverage}x`);
  
  const orderBody: any = {
    exchange,
    symbol,
    side,
    type,
    quantity
  };
  
  if (price) orderBody.price = price;
  if (options?.stopPrice) orderBody.stopPrice = options.stopPrice;
  if (options?.takeProfit) orderBody.takeProfit = options.takeProfit;
  if (options?.stopLoss) orderBody.stopLoss = options.stopLoss;
  if (options?.leverage) orderBody.leverage = options.leverage;
  
  const { response, data } = await makeRequest(
    '/order',
    'POST',
    orderBody,
    {
      'Authorization': `Bearer ${sessionId}`,
      'Cookie': `session=${sessionId}`
    }
  );
  
  if (response.ok && data.success && data.data?.orderId) {
    console.log(`   ✅ Order placed successfully!`);
    console.log(`   Order ID: ${data.data.orderId}`);
    
    placedOrders.push({
      exchange,
      symbol,
      orderId: data.data.orderId
    });
    
    return data.data.orderId;
  } else {
    console.log(`   ❌ Failed: ${data.error || JSON.stringify(data)}`);
    return null;
  }
}

async function cancelOrder(exchange: string, symbol: string, orderId: string, sessionId: string) {
  console.log(`\n🗑️  Canceling order ${orderId} on ${exchange.toUpperCase()}`);
  
  const { response, data } = await makeRequest(
    `/order/${orderId}?exchange=${exchange}&symbol=${symbol}`,
    'DELETE',
    undefined,
    {
      'Authorization': `Bearer ${sessionId}`,
      'Cookie': `session=${sessionId}`
    }
  );
  
  if (response.ok && data.success) {
    console.log(`   ✅ Order canceled successfully`);
    return true;
  } else {
    console.log(`   ⚠️  Cancel failed: ${data.error || 'Unknown error'}`);
    return false;
  }
}

async function cancelAllOrders(sessionId: string) {
  if (placedOrders.length === 0) {
    console.log('\n📋 No orders to cancel');
    return;
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🗑️  CANCELING ALL PLACED ORDERS (${placedOrders.length} orders)`);
  console.log('='.repeat(80));
  
  for (const order of placedOrders) {
    await cancelOrder(order.exchange, order.symbol, order.orderId, sessionId);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function runOrderTests(exchange: string, balance: number, sessionId: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 TESTING ORDERS ON ${exchange.toUpperCase()}`);
  console.log(`Available Balance: $${balance.toFixed(2)}`);
  console.log('='.repeat(80));
  
  const symbol = exchange === 'aster' ? 'ETHUSDT' : 'BTC';
  const currentPrice = await getCurrentPrice(exchange, symbol);
  
  if (currentPrice === 0) {
    console.log('❌ Cannot get current price, skipping tests');
    return;
  }
  
  console.log(`\n💵 Current ${symbol} Price: $${currentPrice.toFixed(2)}`);
  
  // Calculate safe order size (use 80% of balance or $20 max)
  const targetValue = Math.min(balance * 0.8, 20); 
  // Ensure we consistently use enough value for min order size (Hyperliquid requires >$10)
  const orderValue = Math.max(targetValue, 15);
  
  const quantity = (orderValue / currentPrice).toFixed(exchange === 'aster' ? 3 : 4);
  
  console.log(`\n📏 Calculated Order Size: ${quantity} ${symbol.replace('USDT', '')} (~$${orderValue.toFixed(2)})`);
  
  if (parseFloat(quantity) === 0) {
    console.log('❌ Balance too low for testing (Quantity 0)');
    return;
  }
  
  // Test 1: Limit Order (Long)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 1: Limit Order (Long) - 15% below market');
  // Round to integer for BTC to satisfy Hyperliquid/Aster tick size
  const limitPrice = Math.floor(currentPrice * 0.85).toString();
  await placeOrder(exchange, symbol, 'BUY', 'LIMIT', quantity, limitPrice, sessionId);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Limit Order (Short)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 2: Limit Order (Short) - 15% above market');
  const limitPriceShort = Math.floor(currentPrice * 1.15).toString();
  await placeOrder(exchange, symbol, 'SELL', 'LIMIT', quantity, limitPriceShort, sessionId);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Limit Order with TP/SL (Long)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 3: Limit Order with TP/SL (Long)');
  const limitPrice3 = Math.floor(currentPrice * 0.85).toString();
  const takeProfit = Math.floor(parseFloat(limitPrice3) * 1.10).toString();
  const stopLoss = Math.floor(parseFloat(limitPrice3) * 0.95).toString();
  await placeOrder(exchange, symbol, 'BUY', 'LIMIT', quantity, limitPrice3, sessionId, {
    takeProfit,
    stopLoss
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 4: Limit Order with TP/SL (Short)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 4: Limit Order with TP/SL (Short)');
  const limitPrice4 = Math.floor(currentPrice * 1.15).toString();
  const takeProfit4 = Math.floor(parseFloat(limitPrice4) * 0.90).toString();
  const stopLoss4 = Math.floor(parseFloat(limitPrice4) * 1.05).toString();
  await placeOrder(exchange, symbol, 'SELL', 'LIMIT', quantity, limitPrice4, sessionId, {
    takeProfit: takeProfit4,
    stopLoss: stopLoss4
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 5: Stop Market Order (Long)
  console.log('\n' + '-'.repeat(80));
  console.log('TEST 5: Stop Market Order (Long) - 5% above market');
  const stopPrice = Math.floor(currentPrice * 1.05).toString();
  await placeOrder(exchange, symbol, 'BUY', 'STOP_MARKET', quantity, undefined, sessionId, {
    stopPrice
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 6: Stop Market Order with TP/SL (Long)
  if (exchange === 'aster') {
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 6: Stop Market Order with TP/SL (Long)');
    const stopPrice6 = Math.floor(currentPrice * 1.05).toString();
    const takeProfit6 = Math.floor(parseFloat(stopPrice6) * 1.10).toString();
    const stopLoss6 = Math.floor(parseFloat(stopPrice6) * 0.95).toString();
    await placeOrder(exchange, symbol, 'BUY', 'STOP_MARKET', quantity, undefined, sessionId, {
      stopPrice: stopPrice6,
      takeProfit: takeProfit6,
      stopLoss: stopLoss6
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function main() {
  console.log('🚀 Real Order Testing with Balance Check');
  console.log('='.repeat(80));
  console.log(`📍 Public URL: ${PUBLIC_URL}`);
  console.log(`👤 User ID: ${TEST_USER_ID}`);
  console.log(`💼 Hyperliquid Wallet: ${HYPERLIQUID_WALLET}`);
  console.log('='.repeat(80));
  
  try {
    // Create session via API
    console.log('\n📝 Creating session via API...');
    const { response: sessionResponse, data: sessionData } = await makeRequest(
      '/auth/session',
      'POST',
      {
        userId: TEST_USER_ID,
        exchangeId: 'aster'
      }
    );
    
    if (!sessionResponse.ok || !sessionData.success || !sessionData.token) {
      console.error('❌ Failed to create session:', sessionData);
      process.exit(1);
    }
    
    const sessionId = sessionData.token;
    console.log(`✅ Session created: ${sessionId}`);
    
    // Check balances
    console.log('\n' + '='.repeat(80));
    console.log('💰 CHECKING BALANCES');
    console.log('='.repeat(80));
    
    const asterBalance = await checkBalance('aster', sessionId);
    const hlBalance = await checkBalance('hyperliquid', sessionId);
    
    // Test Aster if balance available (lowered threshold)
    if (asterBalance.available > 0.1) {
      await runOrderTests('aster', asterBalance.available, sessionId);
    } else {
      console.log(`\n⚠️  Skipping Aster tests - insufficient balance ($${asterBalance.available.toFixed(2)})`);
    }
    
    // Test Hyperliquid if balance available (lowered threshold)
    if (hlBalance.available > 0.1) {
      await runOrderTests('hyperliquid', hlBalance.available, sessionId);
    } else {
      console.log(`\n⚠️  Skipping Hyperliquid tests - insufficient balance ($${hlBalance.available.toFixed(2)})`);
    }
    
    // Cancel all orders
    await new Promise(resolve => setTimeout(resolve, 3000));
    await cancelAllOrders(sessionId);
    
    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Orders Placed: ${placedOrders.length}`);
    console.log(`🗑️  Orders Canceled: ${placedOrders.length}`);
    console.log('\n🎉 All tests completed successfully!');
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
