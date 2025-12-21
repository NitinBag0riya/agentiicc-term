
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';

async function debug() {
  console.log('Starting debug...');
  try {
    // Instantiate with empty private key to trigger Read-Only path (and my instrumentation)
    new HyperliquidAdapter('0x0000000000000000000000000000000000000000', '');
    console.log('Adapter instantiated.');
  } catch (e) {
    console.error('Debug failed:', e);
  }
}

debug();
