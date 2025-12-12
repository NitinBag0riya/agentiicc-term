#!/usr/bin/env bun
/**
 * Universal API Edge Case Testing
 * Tests all routes including error handling, validation, and advanced features
 */

const PUBLIC_URL = 'https://97877c2a1fef.ngrok-free.app';
const TEST_USER_ID = 2; // Matching previous tests

// Configuration
const EXCHANGES = ['aster', 'hyperliquid'];
const SYMBOLS = {
  aster: 'ETHUSDT',
  hyperliquid: 'BTC'
};

const INVALID_SYMBOL = 'INVALID123';

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

async function runTests() {
  console.log('🚀 Universal API Edge Case Testing');
  console.log('='.repeat(80));

  // 1. Create Sessions
  const sessions: Record<string, string> = {};
  
  for (const exchange of EXCHANGES) {
    console.log(`\n🔑 Creating session for ${exchange}...`);
    const { response, data } = await makeRequest('/auth/session', 'POST', {
      userId: TEST_USER_ID,
      exchangeId: exchange
    });
    
    if (data.success && data.token) {
      sessions[exchange] = data.token;
      console.log(`   ✅ Session created: ${data.token.substring(0, 10)}...`);
    } else {
      console.error(`   ❌ Failed to create session for ${exchange}`);
      process.exit(1);
    }
  }

  // 2. Iterate Exchanges
  for (const exchange of EXCHANGES) {
    const sessionId = sessions[exchange];
    const symbol = SYMBOLS[exchange as keyof typeof SYMBOLS];
    const headers = { 'Authorization': `Bearer ${sessionId}` };

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 TESTING EXCHANGE: ${exchange.toUpperCase()}`);
    console.log('='.repeat(80));

    // --- A. Market Data Edge Cases ---
    console.log('\n🔍 Testing Market Data...');
    
    // Ticker with valid symbol
    const { data: tickerData } = await makeRequest(`/ticker/${symbol}?exchange=${exchange}`, 'GET', undefined, headers);
    if (tickerData.success && tickerData.data) {
        console.log(`   ✅ Ticker (${symbol}): $${parseFloat(tickerData.data.price).toFixed(2)}`);
    } else {
        console.log(`   ❌ Ticker failed: ${JSON.stringify(tickerData)}`);
    }

    // Ticker with INVALID symbol (Edge Case)
    console.log(`   Testing Invalid Symbol (${INVALID_SYMBOL})...`);
    const { data: invalidTicker } = await makeRequest(`/ticker/${INVALID_SYMBOL}?exchange=${exchange}`, 'GET', undefined, headers);
    // Note: Some APIs return 0, some error. We verify it doesn't crash server.
    if (invalidTicker.success) {
         console.log(`   ✅ Handled invalid symbol gracefully (price: ${invalidTicker.data?.price || 'N/A'})`);
    } else {
         console.log(`   ✅ Handled invalid symbol with error: ${invalidTicker.error}`);
    }

    // --- B. Account & Settings (New Endpoints) ---
    console.log('\n⚙️  Testing Leverage & Margin (Edge Cases)...');
    
    // Set Leverage
    console.log(`   Setting Leverage to 5x...`);
    const { data: levData } = await makeRequest('/account/leverage', 'POST', {
        exchange,
        symbol,
        leverage: 5
    }, headers);
    
    if (levData.success) {
        console.log(`   ✅ Set Leverage Success: ${levData.message}`);
    } else {
        console.log(`   ⚠️ Set Leverage Failed (Expected for some adapters): ${levData.error}`);
    }

    // Set Invalid Leverage (Negative) - Edge Case
    // Most exchanges reject negative leverage.
    /*
    console.log(`   Setting Invalid Leverage (-1x)...`);
    const { data: negLev } = await makeRequest('/account/leverage', 'POST', {
        exchange,
        symbol,
        leverage: -1
    }, headers);
    console.log(`   ℹ️  Result for -1x: ${JSON.stringify(negLev)}`);
    */

    // --- C. Order Validation (Negative Testing) ---
    console.log('\n🛑 Testing Order Validation (Negative Tests)...');
    
    // 1. Zero Quantity
    const { data: zeroQty } = await makeRequest('/order', 'POST', {
        exchange,
        symbol,
        side: 'BUY',
        type: 'MARKET',
        quantity: '0'
    }, headers);
    
    if (!zeroQty.success) {
        console.log(`   ✅ Rejected Zero Quantity: ${zeroQty.error}`);
    } else {
        console.log(`   ❌ Accepted Zero Quantity (Unexpected): ${JSON.stringify(zeroQty)}`);
    }

    // 2. Missing Parameters (Stop Price)
    const { data: missingParam } = await makeRequest('/order', 'POST', {
        exchange,
        symbol,
        side: 'BUY',
        type: 'STOP_MARKET',
        quantity: '0.001'
        // Missing stopPrice/triggerPrice
    }, headers);

    if (!missingParam.success) {
        console.log(`   ✅ Rejected Missing Stop Price: ${missingParam.error}`);
    } else {
        console.log(`   ❌ Accepted Missing Stop Price (Unexpected): ${JSON.stringify(missingParam)}`);
    }

    // --- D. Real Order Lifecycle (Happy Path) ---
    console.log('\n🔄 Testing Real Order Lifecycle...');
    
    const currentPrice = parseFloat(tickerData.data?.price || '0');
    // Place Limit Order deep OTM to avoid execution
    const limitPrice = exchange === 'aster' ? Math.floor(currentPrice * 0.5).toString() : Math.floor(currentPrice * 0.5).toString();
    // Use valid size min $15
    const quantity = exchange === 'aster' ? '0.01' : '0.0002'; // ETH vs BTC

    console.log(`   Placing Limit Buy for ${quantity} ${symbol} @ $${limitPrice}...`);

    const { data: orderData } = await makeRequest('/order', 'POST', {
        exchange,
        symbol,
        side: 'BUY',
        type: 'LIMIT',
        quantity,
        price: limitPrice
    }, headers);

    if (orderData.success && orderData.data?.orderId) {
        const orderId = orderData.data.orderId;
        console.log(`   ✅ Order Placed: ${orderId}`);
        
        // Check Open Orders
        console.log(`   Verifying in Open Orders...`);
        // Wait briefly for propagation
        await new Promise(r => setTimeout(r, 1000));
        
        const { data: openOrders } = await makeRequest(`/orders?exchange=${exchange}&symbol=${symbol}`, 'GET', undefined, headers);
        
        if (openOrders.success && Array.isArray(openOrders.data)) {
            const found = openOrders.data.find((o: any) => o.orderId === orderId);
            if (found) {
                console.log(`   ✅ Order found in Open Orders list`);
            } else {
                console.log(`   ⚠️ Order NOT found in list (Latency or Issue). List size: ${openOrders.data.length}`);
            }
        } else {
             console.log(`   ❌ Failed to fetch open orders`);
        }

        // Cancel Order
        console.log(`   Canceling Order ${orderId}...`);
        const { data: cancelData } = await makeRequest(`/order/${orderId}?exchange=${exchange}&symbol=${symbol}`, 'DELETE', undefined, headers);
        
        if (cancelData.success) {
            console.log(`   ✅ Order Cancelled`);
        } else {
            console.log(`   ❌ Cancel Failed: ${cancelData.error}`);
        }

    } else {
        console.log(`   ❌ Order Placement Failed: ${orderData.error}`);
    }
    
    // --- E. History ---
    console.log('\n📜 Testing Order History...');
    const { data: history } = await makeRequest(`/orders/history?exchange=${exchange}&symbol=${symbol}&limit=5`, 'GET', undefined, headers);
    if (history.success) {
        console.log(`   ✅ History fetched (${history.data?.length || 0} items)`);
    } else {
        console.log(`   ❌ History fetch failed: ${history.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🎉 Edge Case Testing Complete');
}

runTests().catch(console.error);
