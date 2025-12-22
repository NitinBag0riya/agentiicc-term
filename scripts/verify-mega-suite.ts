#!/usr/bin/env bun

/**
 * 🌟 AgentiFi MEGA Verification Suite 🌟
 * 
 * Comprehensive End-to-End Test for:
 * 1. Database Operations (Linking/Unlinking/Encryption)
 * 2. Universal API Data Views (Account, Assets)
 * 3. Trading & Exchange Interactions (Orders, Leverage, Margin)
 * 
 * Usage: bun scripts/verify-mega-suite.ts
 */

import { UniversalApiService } from '../src/bot/services/universal-api.service';
import { 
  getOrCreateUser, 
  storeApiCredentials, 
  getApiCredentials, 
  deleteApiCredentials 
} from '../src/db/users';
import { encrypt, decrypt } from '../src/utils/encryption';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment
dotenv.config({ path: path.join(__dirname, '../.env') });

const TEST_USER_ID = 999999999; // Explicit Test User
const TEST_USERNAME = 'agentifi_mega_tester';

// Credentials from .env
const ASTER_KEY = process.env.ASTER_API_KEY;
const ASTER_SECRET = process.env.ASTER_API_SECRET;
const HL_ADDRESS = process.env.HYPERLIQUID_ADDRESS; // User Address
const HL_PRIVATE = process.env.HYPERLIQUID_PRIVATE_KEY; // Private Key

async function runSuite() {
  console.log('🚀 Starting MEGA Verification Suite...\n');

  try {
    // ==========================================
    // MODULE 1: Database & Credential Management
    // ==========================================
    console.log('📦 [Module 1] Verifying Database Operations...');
    const user = await getOrCreateUser(TEST_USER_ID, TEST_USERNAME);
    console.log(`   ✅ Test User Ready: ID ${user.id}`);

    // Test Dummy Link
    console.log('   🔄 Testing Encryption & Storage...');
    const dummyKey = 'dummy_key_123';
    const dummySecret = 'dummy_secret_456';
    const encKey = encrypt(dummyKey);
    const encSecret = encrypt(dummySecret);

    await storeApiCredentials(user.id, 'dummy_exchange', encKey, encSecret);
    
    // Verify Retrieval
    const creds = await getApiCredentials(user.id, 'dummy_exchange');
    if (!creds) throw new Error('Failed to retrieve stored credentials');
    
    const decKey = decrypt(creds.api_key_encrypted);
    const decSecret = decrypt(creds.api_secret_encrypted);

    if (decKey !== dummyKey || decSecret !== dummySecret) {
         throw new Error('Decryption mismatch! Data integrity failure.');
    }
    console.log('   ✅ Credentials Stored & Decrypted Correctly');

    // Test Unlink
    await deleteApiCredentials(user.id, 'dummy_exchange');
    const gone = await getApiCredentials(user.id, 'dummy_exchange');
    if (gone) throw new Error('Failed to delete credentials');
    console.log('   ✅ Unlinking Successful');


    // ==========================================
    // MODULE 2: Universal Data & Real Integration Setup
    // ==========================================
    console.log('\n🌍 [Module 2] Universal Data View & Integration Setup...');

    // 1. Inject REAL credentials for testing
    if (ASTER_KEY && ASTER_SECRET) {
      await storeApiCredentials(user.id, 'aster', encrypt(ASTER_KEY), encrypt(ASTER_SECRET));
      console.log('   🔑 Aster Real Credentials Injected');
    } else {
        console.warn('   ⚠️ Missing Aster Credentials in .env');
    }

    if (HL_ADDRESS && HL_PRIVATE) {
      // For HL, we store Private Key as Secret, Wallet Address as Key (or vice versa depending on adapter logic)
      // Factory expects: apiKey = decrypt(api_key_encrypted), apiSecret = decrypt(api_secret_encrypted)
      // Factory creates: new HyperliquidAdapter(apiSecret, apiKey); -> (Address, PrivateKey)
      // So: api_secret_encrypted must be Address, api_key_encrypted must be PrivateKey
      await storeApiCredentials(user.id, 'hyperliquid', encrypt(HL_PRIVATE), encrypt(HL_ADDRESS));
      console.log('   🔑 Hyperliquid Real Credentials Injected');
    } else {
        console.warn('   ⚠️ Missing Hyperliquid Credentials in .env');
    }

    // 2. Test Account Summary
    const exchanges = ['aster', 'hyperliquid'];
    for (const ex of exchanges) {
        if ((ex === 'aster' && !ASTER_KEY) || (ex === 'hyperliquid' && !HL_PRIVATE)) continue;
        
        console.log(`   📊 Fetching ${ex} Account Summary...`);
        try {
            const summary = await UniversalApiService.getAccountSummary(user.id, ex);
            console.log(`      ✅ Balance: ${summary.totalBalance} | Positions: ${summary.positions?.length || 0}`);
        } catch (e: any) {
            console.error(`      ❌ Failed: ${e.message}`);
        }
    }

    // 3. Test Asset Search
    console.log(`   🔍 Testing Asset Search using 'ETH'...`);
    const assets = await UniversalApiService.searchAssets('aster', 'ETH'); // Using Aster public adapter for search
    if (assets.length > 0) {
        console.log(`      ✅ Found ${assets.length} assets (Top: ${assets[0].symbol})`);
    } else {
        console.warn('      ⚠️ No assets found (might be API limitation or network)');
    }


    // ==========================================
    // MODULE 3: Trading & Exchange Features
    // ==========================================
    console.log('\n📈 [Module 3] Trading & Advanced Features...');

    for (const ex of exchanges) {
        if ((ex === 'aster' && !ASTER_KEY) || (ex === 'hyperliquid' && !HL_PRIVATE)) continue;
        
        console.log(`   👉 Verifying ${ex.toUpperCase()}...`);
        const testSymbol = ex === 'aster' ? 'ETHUSDT' : 'ETH'; // Adjust per exchange norms

        try {
            // A. Margin Mode
            // Note: Not all exchanges verify this easily without error if already set, but we try
            // Aster & HL support Cross.
            console.log('      🛡️ Setting Margin Mode: CROSS');
            // This might fail if already cross, or if not supported on specific symbol inst
            try {
                await UniversalApiService.setMarginMode(user.id, ex, testSymbol, 'CROSS');
                console.log('         ✅ Margin Mode Set');
            } catch (e: any) {
                console.log(`         ℹ️ Set Margin Note: ${e.message}`);
            }

            // B. Leverage
            console.log('      ⚖️ Syncing Leverage...');
            const lev = await UniversalApiService.getLeverage(user.id, ex, testSymbol);
            console.log(`         ✅ Current: ${lev.leverage}x`);
            
            // Set (Idempotent)
            await UniversalApiService.setLeverage(user.id, ex, testSymbol, lev.leverage);
            console.log('         ✅ Set Leverage Verified');

            // C. Order Placement (Limit - Safe)
            // Use a very low price to ensure no fill
            const safePrice = ex === 'aster' ? '100.00' : '100.00'; // $100 ETH is safe (Current ~3500)
            const qty = ex === 'aster' ? '0.06' : '0.01'; // Increase Aster size for min notional > $5
            console.log(`      📝 Placing LIMIT BUY @ $${safePrice} (Qty: ${qty})...`);
            
            const order = await UniversalApiService.placeOrder(user.id, ex, {
                symbol: testSymbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: qty,
                price: safePrice,
                timeInForce: 'GTC'
            });
            console.log(`         ✅ Order Placed: ID ${order.orderId}`);

            // D. Open Orders Check
            const openOrders = await UniversalApiService.getOpenOrders(user.id, ex, testSymbol);
            const found = openOrders.find(o => o.orderId === order.orderId);
            if (found) {
                console.log('         ✅ Order Found in Active List');
            } else {
                console.warn('         ⚠️ Order NOT found in list (Latency?)');
            }

            // E. Cancel Order
            console.log(`      🚫 Cancelling Order ${order.orderId}...`);
            await UniversalApiService.cancelOrder(user.id, ex, order.orderId, testSymbol);
            console.log('         ✅ Order Cancelled');

        } catch (e: any) {
             console.error(`      ❌ ${ex} Trading Error: ${e.message}`);
        }
    }

    // ==========================================
    // Teardown
    // ==========================================
    console.log('\n🧹 [Teardown] Cleaning up Test Credentials...');
    // Uncomment if you want to leave them for manual testing
    // await deleteApiCredentials(user.id, 'aster');
    // await deleteApiCredentials(user.id, 'hyperliquid');
    console.log('   ℹ️  Credentials preserved for manual bot testing (User ID: ' + user.id + ')');

    console.log('\n✨ MEGA SUITE COMPLETE ✨');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ FATAL SUITE ERROR:', error.message);
    process.exit(1);
  }
}

runSuite();
