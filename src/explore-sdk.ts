
import { Hyperliquid } from 'hyperliquid';

console.log('SDK Keys:', Object.keys(Hyperliquid));
// Check prototype or instance methods
// We need something like "getAgentPayload" or see how "approveAgent" works

try {
  const sdk = new Hyperliquid({ enableAllMids: false });
  console.log('SDK Instance Keys:', Object.keys(sdk));
  console.log('SDK Exchange Keys:', sdk.exchange ? Object.keys(sdk.exchange) : 'No Exchange');
  console.log('SDK Info Keys:', sdk.info ? Object.keys(sdk.info) : 'No Info');
  
  // Checking for helper to construct EIP-712 types
} catch (e) {
  console.error(e);
}
