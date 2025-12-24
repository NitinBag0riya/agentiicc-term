/**
 * Test Ticker directly via Adapters (no API server needed)
 */

import { AdapterFactory } from './src/backend/adapters/factory';
import { connectPostgres } from './src/db/postgres';
import { initEncryption } from './src/utils/encryption';

async function testTickers() {
  console.log('🧪 TICKER TEST (Direct Adapter Call)\n');
  console.log('=' .repeat(50));

  initEncryption(process.env.ENCRYPTION_KEY!);
  await connectPostgres();

  // Test Aster
  console.log('\n🔵 ASTER TICKER TEST:');
  try {
    const asterAdapter = AdapterFactory.createPublicAdapter('aster');
    const asterTicker = await asterAdapter.getTicker('ETHUSDT');
    console.log('   Symbol: ETHUSDT');
    console.log('   Price: $' + asterTicker.price);
    console.log('   ✅ Success!');
  } catch (err: any) {
    console.log('   ❌ Failed:', err.message);
  }

  // Test Hyperliquid
  console.log('\n🟣 HYPERLIQUID TICKER TEST:');
  try {
    const hlAdapter = AdapterFactory.createPublicAdapter('hyperliquid');
    const hlTicker = await hlAdapter.getTicker('ETH');
    console.log('   Symbol: ETH');
    console.log('   Price: $' + hlTicker.price);
    console.log('   ✅ Success!');
  } catch (err: any) {
    console.log('   ❌ Failed:', err.message);
  }

  // Also test BTC
  console.log('\n🟣 HYPERLIQUID BTC TICKER TEST:');
  try {
    const hlAdapter = AdapterFactory.createPublicAdapter('hyperliquid');
    const btcTicker = await hlAdapter.getTicker('BTC');
    console.log('   Symbol: BTC');
    console.log('   Price: $' + btcTicker.price);
    console.log('   ✅ Success!');
  } catch (err: any) {
    console.log('   ❌ Failed:', err.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 TICKER TEST COMPLETE\n');
  process.exit(0);
}

testTickers();
