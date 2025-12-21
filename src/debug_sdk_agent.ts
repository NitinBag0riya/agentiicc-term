
import { Hyperliquid } from 'hyperliquid';
import { ethers } from 'ethers';

async function debug() {
  const pk = '0x' + '1'.repeat(64); // Dummy Key
  const wallet = new ethers.Wallet(pk);
  
  const sdk = new Hyperliquid({
    enableWs: false,
    privateKey: pk,
    testnet: false 
  });

  console.log('Exchange Keys:', Object.keys(sdk.exchange));
  
  try {
     const agent = ethers.Wallet.createRandom().address;
     console.log('Attempting approveAgent for:', agent);
     
     // Trying typical method names
     if (sdk.exchange.approveAgent) {
         await sdk.exchange.approveAgent({ agentAddress: agent, agentName: 'AgentiFi' });
     } else {
         console.log('approveAgent method not found.');
     }
  } catch (e) {
      console.log('Error calling approveAgent:', e.message);
      if (e.request) {
          console.log('Request Body:', e.request.body);
      }
      if (e.data) {
          console.log('Error Data:', e.data);
      }
  }
}

debug();
