
import { UniversalApiClient } from './src/services/universalApi';
import { getOrCreateUser, storeApiCredentials } from './src/db/users';
import { connectPostgres } from './src/db/postgres';
import { encrypt, initEncryption } from './src/utils/encryption';

// Config
const TEST_TELEGRAM_ID = 88888;

interface TradeTestParams {
  exchange: string;
  symbol: string;
  minQty: string;
  leverage: number;
  testPrice: number;
}

const ASTER_PARAMS: TradeTestParams = {
  exchange: 'aster',
  symbol: 'BTCUSDT',
  minQty: '0.001',
  leverage: 10,
  testPrice: 0.5 // 50% of market
};

const HL_PARAMS: TradeTestParams = {
  exchange: 'hyperliquid',
  symbol: 'ETH',
  minQty: '0.01',
  leverage: 5,
  testPrice: 0.5
};

async function runTradeTests() {
  console.log('🚀 Trade Parameter Verification Test...\n');

  try {
    if (!process.env.ENCRYPTION_KEY) throw new Error("Missing ENCRYPTION_KEY");
    initEncryption(process.env.ENCRYPTION_KEY);
    await connectPostgres();

    // Setup User
    const user = await getOrCreateUser(TEST_TELEGRAM_ID, 'TradeTest');
    console.log(`✅ User: ID ${user.id}`);

    // Setup Credentials
    if (process.env.ASTER_API_KEY) {
      await storeApiCredentials(user.id, encrypt(process.env.ASTER_API_KEY), encrypt(process.env.ASTER_API_SECRET!), false, 'aster');
      console.log('✅ Aster Creds Ready');
    }
    if (process.env.HYPERLIQUID_PRIVATE_KEY) {
      await storeApiCredentials(user.id, encrypt(process.env.HYPERLIQUID_PRIVATE_KEY), encrypt(process.env.HYPERLIQUID_ADDRESS!), false, 'hyperliquid');
      console.log('✅ Hyperliquid Creds Ready');
    }

    // Test Aster
    console.log('\n━━━━━ ASTER TEST ━━━━━');
    await testExchange(user.id, ASTER_PARAMS);

    // Test Hyperliquid
    console.log('\n━━━━━ HYPERLIQUID TEST ━━━━━');
    await testExchange(user.id, HL_PARAMS);

    console.log('\n🏁 All Trade Tests Complete');
    process.exit(0);
  } catch (e) {
    console.error('❌ Test Failed:', e);
    process.exit(1);
  }
}

async function testExchange(userId: number, params: TradeTestParams) {
  const client = new UniversalApiClient();
  await client.initSession(userId, params.exchange);
  console.log(`[${params.exchange}] Session OK`);

  // Get Ticker
  console.log(`[${params.exchange}] Getting Ticker for ${params.symbol}...`);
  const tickerRes = await client.getTicker(params.symbol);

  let marketPrice = 0;
  if (tickerRes.success) {
    const priceField = tickerRes.data.price || tickerRes.data.markPrice || tickerRes.data.lastPrice || tickerRes.data.midPx;
    marketPrice = parseFloat(priceField);
    console.log(`   ✅ Price: $${marketPrice}`);
  } else {
    console.log(`   ⚠️ Ticker Failed: ${tickerRes.error}`);
    marketPrice = params.exchange === 'aster' ? 90000 : 3000; // Fallback
    console.log(`   Using fallback: $${marketPrice}`);
  }

  // Calculate test price (far from market)
  const limitPrice = Math.floor(marketPrice * params.testPrice);

  // Get Leverage Info
  console.log(`[${params.exchange}] Leverage: ${params.leverage}x`);

  // Recommended Amount
  const minNotional = 5; // $5 minimum
  const recommendedQty = Math.max(parseFloat(params.minQty), (minNotional / limitPrice) * 1.5);
  console.log(`[${params.exchange}] Recommended Qty: ${recommendedQty.toFixed(4)} (Min: ${params.minQty})`);

  // Place Test Order
  console.log(`[${params.exchange}] Placing Limit Order @ $${limitPrice}...`);
  const orderParams = {
    symbol: params.symbol,
    side: 'BUY',
    type: 'LIMIT',
    quantity: recommendedQty.toFixed(4),
    price: limitPrice.toString(),
    timeInForce: 'GTC',
    exchange: params.exchange
  };

  const orderRes = await client.placeOrder(orderParams);
  if (orderRes.success) {
    console.log(`   ✅ Order Placed: ID ${orderRes.data.orderId}`);

    // Cancel it
    const cancelRes = await client.cancelOrder(orderRes.data.orderId, params.symbol);
    if (cancelRes.success) {
      console.log('   ✅ Order Cancelled');
    } else {
      console.log(`   ⚠️ Cancel Failed: ${cancelRes.error}`);
    }
  } else {
    console.log(`   ❌ Order Failed: ${orderRes.error}`);
  }

  // Print Summary
  console.log(`\n📋 ${params.exchange.toUpperCase()} Trade Parameters:`);
  console.log(`   Symbol: ${params.symbol}`);
  console.log(`   Min Qty: ${params.minQty}`);
  console.log(`   Leverage: Up to ${params.leverage}x`);
  console.log(`   Min Notional: ~$5 USDT`);
  console.log(`   Recommended Test Amount: ${recommendedQty.toFixed(4)}`);
}

runTradeTests();
