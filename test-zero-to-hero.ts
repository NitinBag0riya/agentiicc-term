#!/usr/bin/env bun
/**
 * Zero to Hero API Test
 * Covers all endpoints, types, and edge cases.
 * DISPLAYS FULL JSON RESPONSES for verification.
 */

const PUBLIC_URL = 'https://97877c2a1fef.ngrok-free.app';
const TEST_USER_ID = 2;

// Configuration
const CONFIG = {
  aster: { symbol: 'ETHUSDT', price: 1500, quantity: '0.01' },     // ~ $15 order
  hyperliquid: { symbol: 'BTC', price: 45000, quantity: '0.0004' } // ~ $18 order
};

const EXCHANGES = ['aster', 'hyperliquid'];

// Helper to print JSON clearly
function logResponse(label: string, data: any) {
  console.log(`\n🔹 ${label} Response:`);
  console.dir(data, { depth: null, colors: true });
}

async function makeRequest(route: string, method: string = 'GET', body?: any, headers?: Record<string, string>) {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  
  if (body && method !== 'GET') options.body = JSON.stringify(body);
  
  const url = route.startsWith('http') ? route : `${PUBLIC_URL}${route}`;
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json') ? await response.json() : await response.text();
    return data;
  } catch (error: any) {
    return { error: error.message };
  }
}

async function runZeroToHero() {
  console.log('🚀 ZERO TO HERO API TEST');
  console.log('================================================================');

  for (const exchange of EXCHANGES) {
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`🏛️  EXCHANGE: ${exchange.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    const config = CONFIG[exchange as keyof typeof CONFIG];

    // 1. AUTHENTICATION
    console.log(`\n--- [1] Authentication ---`);
    const sessionData = await makeRequest('/auth/session', 'POST', { userId: TEST_USER_ID, exchangeId: exchange });
    logResponse('Session', sessionData);

    if (!sessionData.success || !sessionData.token) {
      console.error('❌ Login failed, skipping exchange.');
      continue;
    }
    const headers = { 'Authorization': `Bearer ${sessionData.token}` };

    // 2. MARKET DATA
    console.log(`\n--- [2] Market Data ---`);
    
    // Ticker
    const ticker = await makeRequest(`/ticker/${config.symbol}?exchange=${exchange}`, 'GET', undefined, headers);
    logResponse(`Ticker (${config.symbol})`, ticker);

    // Orderbook (Truncated)
    const book = await makeRequest(`/orderbook/${config.symbol}?exchange=${exchange}`, 'GET', undefined, headers);
    if (book.data) {
        // Truncate for display
        const displayBook = { ...book.data, bids: book.data.bids.slice(0, 2), asks: book.data.asks.slice(0, 2), _note: '...truncated...' };
        logResponse(`Orderbook (${config.symbol})`, { ...book, data: displayBook });
    } else {
        logResponse(`Orderbook`, book);
    }

    // Assets Search
    const assets = await makeRequest(`/assets/search?q=${config.symbol}&exchange=${exchange}`, 'GET', undefined, headers);
    logResponse(`Asset Search (${config.symbol})`, assets);

    // 3. ACCOUNT
    console.log(`\n--- [3] Account & Settings ---`);

    // Account Info
    const account = await makeRequest(`/account?exchange=${exchange}`, 'GET', undefined, headers);
    logResponse('Account Info', account);

    // Set Leverage
    const leverage = await makeRequest('/account/leverage', 'POST', { exchange, symbol: config.symbol, leverage: 5 }, headers);
    logResponse('Set Leverage (5x)', leverage);

    // Set Margin Mode
    const margin = await makeRequest('/account/margin-mode', 'POST', { exchange, symbol: config.symbol, mode: 'CROSS' }, headers);
    logResponse('Set Margin Mode (CROSS)', margin);

    // 4. ORDERS - EDGE CASES
    console.log(`\n--- [4] Order Edge Cases (Validation) ---`);

    // Zero Qty
    const zeroOrder = await makeRequest('/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'LIMIT', price: '1000', quantity: '0' 
    }, headers);
    logResponse('Place Order (Zero Qty)', zeroOrder);

    // Missing Trigger
    const missingTrigger = await makeRequest('/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'STOP_MARKET', quantity: '0.001' 
    }, headers);
    logResponse('Place Order (Missing Trigger)', missingTrigger);

    // 5. ORDERS - HAPPY PATH
    console.log(`\n--- [5] Order Lifecycle (Place -> Verify -> Cancel) ---`);

    // Place Limit Order (Deep OTM)
    const placeOrder = await makeRequest('/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'LIMIT', price: config.price.toString(), quantity: config.quantity 
    }, headers);
    logResponse('Place Order (Limit)', placeOrder);

    let orderId = placeOrder.data?.orderId;

    if (orderId) {
        // Wait for propagation
        await new Promise(r => setTimeout(r, 1500));

        // Get Open Orders
        const openOrders = await makeRequest(`/orders?exchange=${exchange}&symbol=${config.symbol}`, 'GET', undefined, headers);
        logResponse('Open Orders', openOrders);

        // Cancel Order
        console.log(`\nCancelling Order ${orderId}...`);
        const cancel = await makeRequest(`/order/${orderId}?exchange=${exchange}&symbol=${config.symbol}`, 'DELETE', undefined, headers);
        logResponse('Cancel Order', cancel);
    }

    // 6. HISTORY
    console.log(`\n--- [6] Order History ---`);
    const history = await makeRequest(`/orders/history?exchange=${exchange}&symbol=${config.symbol}&limit=2`, 'GET', undefined, headers);
    logResponse('Order History', history);
  }
}

runZeroToHero().catch(console.error);
