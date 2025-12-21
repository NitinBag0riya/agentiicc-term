
import { Hyperliquid } from 'hyperliquid';

async function main() {
  console.log('Testing Hyperliquid connection...');

  // Use a random valid-looking address (Vitalik's address)
  const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  try {
    const sdk = new Hyperliquid({
      enableWs: false,
      testnet: false,
      walletAddress: address
    });

    console.log(`Fetching clearinghouse state for ${address}...`);
    // @ts-ignore
    const state = await sdk.info.perpetuals.getClearinghouseState(address);
    console.log('Success!', state);
    
  } catch (error) {
    console.error('Failure!');
    console.error(error);
  }
}

main();
