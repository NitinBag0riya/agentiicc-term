
import { UniversalApiClient } from './src/services/universalApi';
import { getOrCreateUser, storeApiCredentials } from './src/db/users';
import { connectPostgres } from './src/db/postgres';
import { encrypt, initEncryption } from './src/utils/encryption';

const TEST_TELEGRAM_ID = 88888;

async function fullTradeTest() {
  console.log('🚀 FULL TRADE FLOW TEST (Both Exchanges)\n');
  console.log('=' .repeat(50));

  try {
    if (!process.env.ENCRYPTION_KEY) throw new Error("Missing ENCRYPTION_KEY");
    initEncryption(process.env.ENCRYPTION_KEY);
    await connectPostgres();

    const user = await getOrCreateUser(TEST_TELEGRAM_ID, 'FullTest');
    console.log(`✅ User ID: ${user.id}\n`);

    // Setup credentials
    if (process.env.ASTER_API_KEY) {
      await storeApiCredentials(user.id, encrypt(process.env.ASTER_API_KEY), encrypt(process.env.ASTER_API_SECRET!), false, 'aster');
    }
    if (process.env.HYPERLIQUID_PRIVATE_KEY) {
      await storeApiCredentials(user.id, encrypt(process.env.HYPERLIQUID_PRIVATE_KEY), encrypt(process.env.HYPERLIQUID_ADDRESS!), false, 'hyperliquid');
    }

    // Test ASTER
    console.log('\n' + '='.repeat(50));
    console.log('🔵 ASTER DEX FULL TEST');
    console.log('='.repeat(50));
    await testFullFlow(user.id, 'aster', 'ETHUSDT', 0.01);

    // Test HYPERLIQUID
    console.log('\n' + '='.repeat(50));
    console.log('🟣 HYPERLIQUID FULL TEST');
    console.log('='.repeat(50));
    await testFullFlow(user.id, 'hyperliquid', 'ETH', 0.01);

    console.log('\n🏁 ALL TESTS COMPLETE');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ FATAL ERROR:', e);
    process.exit(1);
  }
}

async function testFullFlow(userId: number, exchange: string, symbol: string, qty: number) {
  const client = new UniversalApiClient();

  // 1. SESSION
  console.log(`\n[1] INIT SESSION...`);
  const sessionOk = await client.initSession(userId, exchange);
  console.log(sessionOk ? '   ✅ Session OK' : '   ❌ Session Failed');

  // 2. BALANCE CHECK
  console.log(`\n[2] CHECK BALANCE...`);
  const accountRes = await client.getAccount(exchange);
  if (accountRes.success) {
    const data = accountRes.data;
    console.log('   Raw Account Data:', JSON.stringify(data, null, 2).substring(0, 500));
    
    const totalBal = data.totalBalance || data.totalWalletBalance || data.marginSummary?.accountValue || 'N/A';
    const availBal = data.availableBalance || data.withdrawable || 'N/A';
    console.log(`   ✅ Total Balance: ${totalBal}`);
    console.log(`   ✅ Available: ${availBal}`);
  } else {
    console.log(`   ❌ Balance Failed: ${accountRes.error}`);
    return; // Can't proceed without balance
  }

  // 3. GET TICKER
  console.log(`\n[3] GET TICKER (${symbol})...`);
  const tickerRes = await client.getTicker(symbol);
  let price = 3000; // fallback
  if (tickerRes.success) {
    const p = tickerRes.data.price || tickerRes.data.markPrice || tickerRes.data.lastPrice || tickerRes.data.midPx;
    price = parseFloat(p);
    console.log(`   ✅ Price: $${price}`);
  } else {
    console.log(`   ⚠️ Ticker Failed: ${tickerRes.error}, using fallback $${price}`);
  }

  // 4. PLACE MARKET ORDER (LONG)
  console.log(`\n[4] PLACE MARKET ORDER...`);
  console.log(`   Symbol: ${symbol}`);
  console.log(`   Side: BUY (LONG)`);
  console.log(`   Qty: ${qty}`);
  console.log(`   Type: MARKET`);
  console.log(`   Exchange: ${exchange}`);

  const orderParams = {
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity: String(qty),
    exchange
  };

  console.log('   Order Params:', JSON.stringify(orderParams));

  const orderRes = await client.placeOrder(orderParams);
  console.log('   Order Response:', JSON.stringify(orderRes, null, 2));

  if (orderRes.success) {
    console.log(`   ✅ Order Placed: ID ${orderRes.data?.orderId}`);
  } else {
    console.log(`   ❌ Order FAILED: ${orderRes.error}`);
    // Try to get more details
    if (orderRes.data) {
      console.log('   Error Data:', JSON.stringify(orderRes.data));
    }
  }

  // 5. CHECK POSITIONS
  console.log(`\n[5] CHECK POSITIONS...`);
  await new Promise(r => setTimeout(r, 2000)); // Wait for order to fill
  
  const posRes = await client.getPositions(exchange);
  if (posRes.success) {
    console.log(`   ✅ Found ${posRes.data.length} position(s)`);
    const pos = posRes.data.find((p: any) => {
      const sym = p.symbol || p.coin;
      return sym === symbol || sym.includes(symbol.replace('USDT', ''));
    });
    if (pos) {
      console.log(`   Position: ${JSON.stringify(pos)}`);
    } else {
      console.log('   No matching position found');
    }
  } else {
    console.log(`   ❌ Positions Failed: ${posRes.error}`);
  }

  // 6. CLOSE POSITION (if exists)
  console.log(`\n[6] CLOSE POSITION TEST...`);
  const closeParams = {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    quantity: String(qty),
    reduceOnly: true,
    exchange
  };
  
  console.log('   Close Params:', JSON.stringify(closeParams));
  const closeRes = await client.placeOrder(closeParams);
  
  if (closeRes.success) {
    console.log(`   ✅ Close Order Placed: ${closeRes.data?.orderId}`);
  } else {
    console.log(`   ❌ Close Failed: ${closeRes.error}`);
  }

  // 7. FINAL POSITIONS CHECK
  console.log(`\n[7] FINAL POSITION CHECK...`);
  await new Promise(r => setTimeout(r, 1000));
  const finalPos = await client.getPositions(exchange);
  if (finalPos.success) {
    const remaining = finalPos.data.filter((p: any) => {
      const sym = p.symbol || p.coin;
      const size = parseFloat(p.size || p.positionAmt || '0');
      return (sym === symbol || sym.includes(symbol.replace('USDT', ''))) && Math.abs(size) > 0;
    });
    if (remaining.length === 0) {
      console.log('   ✅ Position Closed Successfully');
    } else {
      console.log('   ⚠️ Position still open:', remaining);
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${exchange.toUpperCase()} TEST COMPLETE`);
}

fullTradeTest();
