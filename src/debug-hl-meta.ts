#!/usr/bin/env bun
/**
 * Debug Hyperliquid Meta Response
 */

import 'dotenv/config';
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';

const HL_PRIVATE_KEY = (process.env.HYPERLIQUID_PRIVATE_KEY || '').trim();
const HL_ADDRESS = (process.env.HYPERLIQUID_ADDRESS || '').trim();

(async () => {
    let privateKey = HL_PRIVATE_KEY;
    if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
    }

    const hl = new HyperliquidAdapter(HL_ADDRESS, privateKey);
    
    try {
        // @ts-ignore
        await hl.sdk.connect();
        
        // @ts-ignore
        const meta = await hl.sdk.info.perpetuals.getMeta();
        
        console.log('Meta Response:');
        console.log('Universe length:', meta.universe.length);
        console.log('\nFirst 5 assets:');
        meta.universe.slice(0, 5).forEach((u: any, i: number) => {
            console.log(`  [${i}] ${u.name}`);
        });
        
        // Find ETH
        const ethIndex = meta.universe.findIndex((u: any) => u.name === 'ETH');
        console.log(`\nETH index: ${ethIndex}`);
        if (ethIndex !== -1) {
            console.log('ETH asset:', JSON.stringify(meta.universe[ethIndex], null, 2));
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    }
})();
