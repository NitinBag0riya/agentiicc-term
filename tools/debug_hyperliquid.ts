
import { Hyperliquid } from 'hyperliquid';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log('🔍 Debugging Hyperliquid State...');
    const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
    const address = process.env.HYPERLIQUID_ADDRESS;
    
    if (!address) {
        console.error('Missing HYPERLIQUID_ADDRESS');
        return;
    }

    // @ts-ignore
    const sdk = new Hyperliquid({
        enableWs: false,
        testnet: false,
        privateKey: privateKey,
        walletAddress: address
    });

    try {
        console.log('Fetching Clearinghouse State...');
        const state = await sdk.info.perpetuals.getClearinghouseState(address);
        console.log('--- Account State ---');
        console.log('Margin Summary:', JSON.stringify(state.marginSummary, null, 2));
        console.log('Withdrawable:', state.withdrawable);
        console.log('--- Positions ---');
        console.log(JSON.stringify(state.assetPositions, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
