/**
 * Debug Hyperliquid Ticker
 */

import { Hyperliquid } from 'hyperliquid';

async function testTicker() {
  console.log('🔍 Testing Hyperliquid Ticker...\n');

  const sdk = new Hyperliquid({
    walletPrivateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
  });

  try {
    // Connect
    console.log('[1] Connecting SDK...');
    await sdk.connect();
    console.log('   ✅ Connected\n');

    // Method 1: getAllMids
    console.log('[2] Testing getAllMids()...');
    try {
      // @ts-ignore
      const mids = await sdk.info.getAllMids();
      console.log('   ✅ getAllMids works!');
      console.log('   Sample:', Object.keys(mids).slice(0, 5));
      console.log('   ETH price:', mids['ETH']);
      console.log('   BTC price:', mids['BTC']);
    } catch (err: any) {
      console.log('   ❌ getAllMids failed:', err.message);
    }

    // Method 2: Get all asset contexts (alternative)
    console.log('\n[3] Testing getAssetContexts()...');
    try {
      // @ts-ignore
      const contexts = await sdk.info.perpetuals.getAssetContexts();
      console.log('   ✅ getAssetContexts works!');
      const ethCtx = contexts.find((c: any) => c.coin === 'ETH');
      if (ethCtx) {
        console.log('   ETH context:', JSON.stringify(ethCtx).substring(0, 200));
      }
    } catch (err: any) {
      console.log('   ❌ getAssetContexts failed:', err.message);
    }

    // Method 3: Direct API call
    console.log('\n[4] Testing direct API call...');
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' })
      });
      const data = await response.json();
      console.log('   ✅ Direct API works!');
      console.log('   ETH:', (data as any)['ETH']);
      console.log('   BTC:', (data as any)['BTC']);
    } catch (err: any) {
      console.log('   ❌ Direct API failed:', err.message);
    }

  } catch (err: any) {
    console.error('❌ Error:', err);
  }

  process.exit(0);
}

testTicker();
