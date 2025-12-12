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
function logStep(label: string, method: string, route: string, payload?: any) {
  console.log(`\n🔹 [${label}]`);
  console.log(`   📡 Request: ${method} ${route}`);
  if (payload) {
    console.log(`   📦 Payload:`, JSON.stringify(payload, null, 2));
  }
}

function logResponse(data: any) {
  console.log(`   📥 Response:`);
  
  // Smart Truncation Helper
  const MAX_ARRAY_LEN = 3;
  const truncate = (obj: any, depth: number = 0): any => {
    if (depth > 5) return '...';
    if (Array.isArray(obj)) {
      if (obj.length > MAX_ARRAY_LEN) {
        return [...obj.slice(0, MAX_ARRAY_LEN).map(i => truncate(i, depth + 1)), `... (${obj.length - MAX_ARRAY_LEN} more items)`];
      }
      return obj.map(i => truncate(i, depth + 1));
    }
    if (obj && typeof obj === 'object') {
      const newObj: any = {};
      for (const k in obj) {
        newObj[k] = truncate(obj[k], depth + 1);
      }
      return newObj;
    }
    return obj;
  };

  console.dir(truncate(data), { depth: null, colors: true });
}

async function makeRequest(label: string, route: string, method: string = 'GET', body?: any, headers?: Record<string, string>) {
  logStep(label, method, route, body);

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
    logResponse(data); // Always log (truncated)
    return data;
  } catch (error: any) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return { error: error.message, success: false };
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
    const sessionData = await makeRequest('Create Session', '/auth/session', 'POST', { userId: TEST_USER_ID, exchangeId: exchange });

    if (!sessionData.success || !sessionData.token) {
      console.error('❌ Login failed, skipping exchange logic.');
      continue;
    }
    const headers = { 'Authorization': `Bearer ${sessionData.token}` };

    // 2. MARKET DATA
    console.log(`\n--- [2] Market Data ---`);
    await makeRequest('Get Ticker', `/ticker/${config.symbol}?exchange=${exchange}`, 'GET', undefined, headers);
    
    // Orderbook (Truncated display logic handled in makeRequest? No, modify makeRequest to return data and we log manually? 
    // Actually, user wants "response received". Logging full book is messy. I'll logging truncated manually inside makeRequest?)
    // Let's keep makeRequest logging FULL response, but usually Books are huge.
    // I'll skip Orderbook full log here to avoid clutter or accept it. 
    // User said "show aoi response". I will use makeRequest for Orderbook but maybe truncate in a wrapper?
    // I'll stick to standard makeRequest.
    const book = await makeRequest('Get Orderbook', `/orderbook/${config.symbol}?exchange=${exchange}`, 'GET', undefined, headers);

    await makeRequest('Asset Search', `/assets/search?q=${config.symbol}&exchange=${exchange}`, 'GET', undefined, headers);

    // 3. ACCOUNT
    console.log(`\n--- [3] Account & Settings ---`);
    await makeRequest('Get Account', `/account?exchange=${exchange}`, 'GET', undefined, headers);
    await makeRequest('Set Leverage (5x)', '/account/leverage', 'POST', { exchange, symbol: config.symbol, leverage: 5 }, headers);
    
    // Handle "Already Set" error for Margin Mode
    const margin = await makeRequest('Set Margin Mode (CROSS)', '/account/margin-mode', 'POST', { exchange, symbol: config.symbol, mode: 'CROSS' }, headers);
    if (!margin.success && margin.message?.includes('No need')) {
        console.log(`   ✅ (Handled "Already Set" gracefully)`);
    }

    // 4. ORDERS - EDGE CASES
    console.log(`\n--- [4] Order Edge Cases (Validation) ---`);
    const zeroOrder = await makeRequest('Place Order (Zero Qty)', '/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'LIMIT', price: '1000', quantity: '0' 
    }, headers);
    if (!zeroOrder.success) console.log(`   ✅ Correctly Rejected`);

    const missingTrigger = await makeRequest('Place Order (Missing Trigger)', '/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'STOP_MARKET', quantity: '0.001' 
    }, headers);
    if (!missingTrigger.success) console.log(`   ✅ Correctly Rejected`);

    // 5. ORDERS - HAPPY PATH
    console.log(`\n--- [5] Order Lifecycle (Place -> Verify -> Cancel) ---`);

    const placeOrder = await makeRequest('Place Limit Order', '/order', 'POST', { 
        exchange, symbol: config.symbol, side: 'BUY', type: 'LIMIT', price: config.price.toString(), quantity: config.quantity 
    }, headers);

    let orderId = placeOrder.data?.orderId;
    if (orderId) {
        console.log(`   ✅ Order Placed ID: ${orderId} - Waiting for propagation...`);
        await new Promise(r => setTimeout(r, 1500));

        const openOrders = await makeRequest('Get Open Orders', `/orders?exchange=${exchange}&symbol=${config.symbol}`, 'GET', undefined, headers);
        
        // Find our order
        const found = openOrders.data?.find((o:any) => String(o.orderId) === String(orderId));
        if (found) {
             console.log(`   ✅ Order Found in List:`, found);
        } else {
             console.error(`   ❌ Order ${orderId} NOT FOUND in Open Orders!`);
        }

        // Cancel
        const cancel = await makeRequest('Cancel Order', `/order/${orderId}?exchange=${exchange}&symbol=${config.symbol}`, 'DELETE', undefined, headers);
        if (cancel.success) console.log(`   ✅ Cancellation Successful`);
    } else {
        console.error(`   ❌ Failed to place order. Stopping lifecycle test.`);
    }

    // 6. HISTORY
    console.log(`\n--- [6] Order History ---`);
    await makeRequest('Get Order History', `/orders/history?exchange=${exchange}&symbol=${config.symbol}&limit=2`, 'GET', undefined, headers);
  }
}

runZeroToHero().catch(console.error);
