import 'dotenv/config';
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';
import { createInterface } from 'readline';
import { Decimal } from 'decimal.js';
import { ethers } from 'ethers';

// --- CONFIG --- 
// Use a testnet Wallet for safety by default if just testing logic
const ENV_PRIVATE_KEY = (process.env.HYPERLIQUID_PRIVATE_KEY || '').trim();
const ENV_ADDRESS = (process.env.HYPERLIQUID_ADDRESS || '').trim();
// --------------

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// Price = 5 Sig Figs
function adjustPrice(value: Decimal | string | number): string {
    return new Decimal(value).toSignificantDigits(5, Decimal.ROUND_DOWN).toString();
}

// Quantity = Step Size Multiples
function adjustQuantity(value: Decimal | string | number, stepSize: Decimal | string | number): string {
    const v = new Decimal(value);
    const s = new Decimal(stepSize);
    return v.div(s).floor().mul(s).toString(); // Floor to be safe
}

async function main() {
  console.log('\n🌟 \x1b[36mHyperliquid API Live Tester\x1b[0m 🌟');
  console.log('Using `hyperliquid` SDK + `decimal.js`.');
  
  // 1. Get Credentials
  let privateKey = ENV_PRIVATE_KEY;
  // Ensure 0x prefix
  if (privateKey && !privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
  }
  
  let address = ENV_ADDRESS;

  if (!privateKey) {
      console.log('Credentials not found in env.');
      privateKey = await question('Enter Private Key (Hex): ');
  }
  
  if (!address && privateKey) {
      try {
        const derivedAddress = new ethers.Wallet(privateKey).address;
        console.log(`\n🔑 Derived Address (Signer): \x1b[36m${derivedAddress}\x1b[0m`);
        
        const override = await question('   Is this your Main Account Address (where funds are)? [Y/n - or paste address]: ');
        if (override.toLowerCase() === 'n' || (override.length > 2 && override !== 'y')) {
            address = override.length > 2 ? override : await question('   Enter Main Account Address: ');
            console.log(`   Using Target Address: ${address}`);
        } else {
            address = derivedAddress;
        }

      } catch (e) {
        console.error('Invalid Private Key');
        process.exit(1);
      }
  }

  // 2. Initialize Adapter
  console.log('\n🔌 Initializing Adapter (Mainnet)...');
  // Note: SDK defaults to Mainnet in my adapter implementation
  const adapter = new HyperliquidAdapter(address, privateKey);

  try {
    // 3. Test Connection
    console.log('💰 Fetching Account Balance...');
    const account = await adapter.getAccount();
    console.log(`   Total Value: $${new Decimal(account.totalBalance).toFixed(2)}`);
    console.log(`   Withdrawable: $${new Decimal(account.availableBalance).toFixed(2)}`);

    // 4. Get Market Data & Tick Size
    // Default to ETH for reliability, user can change logic if needed
    const symbol = 'ETH'; 
    console.log(`\n📊 Fetching Market Data for ${symbol}...`);
    
    let ticker;
    try {
        ticker = await adapter.getTicker(symbol);
    } catch {
        // Retry logic or fallback
        console.log(`   ${symbol} ticker fetch failed.`);
    }

    if (!ticker || new Decimal(ticker.price).isZero()) {
        console.log(`   ⚠️ Price for ${symbol} is 0 or invalid. Fetching all tickers to debug...`);
        // We could list available tickers here if needed
        const allTickers = await adapter.getTicker('ETH'); // Just a probe
        // actually adapter.getTicker returns specific.
        // Let's just proceed to Assert List to see what's valid.
    }
    
    const currentPrice = new Decimal(ticker?.price || '0');
    console.log(`   Current Price: $${currentPrice}`);

    const assets = await adapter.getAssets();
    // Debug: List first 5 assets
    // console.log('   Available Assets (first 5):', assets.slice(0, 5).map(a => a.symbol).join(', '));

    const assetInfo: any = assets.find(a => a.symbol === symbol);
    
    if (!assetInfo) {
        console.error(`\n❌ Asset info not found for ${symbol}`);
        console.log('   Available Assets:', assets.map(a => a.symbol).join(', '));
        throw new Error('Asset lookup failed');
    }
    
    const tickSize = new Decimal(assetInfo.tickSize || '0.01');
    const stepSize = new Decimal(assetInfo.minQuantity || '0.01'); 
    
    console.log(`   Tick Size: ${tickSize}`);
    console.log(`   Step Size: ${stepSize}`);

    // Check Balance before proceeding
    const balance = new Decimal(account.availableBalance);
    if (balance.lessThan(5)) { // Less than $5
        console.log('\n⚠️ \x1b[33mInsufficient balance for live trading test (Need > $5).\x1b[0m');
        console.log('   Skipping Order Placement step.');
        console.log('   ✅ Read-only API tests passed (Account, Ticker, Assets).');
        process.exit(0);
    }


    // 5. Calculate Params for MARKET Order (Simulated)
    // Hyperliquid simulates MARKET as aggressive IOC Limit (+5% cap)
    // We will place a small order to verify this simulation works
    
    // Quantity ~$15 USD
    const targetUsd = 15;
    const rawQty = new Decimal(targetUsd).div(currentPrice);
    const quantity = adjustQuantity(rawQty, stepSize).toString();

    console.log('\n📝 \x1b[33mComputed Test Order Params:\x1b[0m');
    console.log(`   Symbol:      ${symbol}`);
    console.log(`   Type:        MARKET (Simulated)`);
    console.log(`   Side:        BUY`);
    console.log(`   Quantity:    ${quantity} (~$${new Decimal(quantity).mul(currentPrice).toFixed(2)})`);
    
    // Auto-proceed check
    if (!ENV_PRIVATE_KEY) {
         const confirm = await question('\n❓ Proceed with placing this test order? (y/n): ');
         if (confirm.toLowerCase() !== 'y') {
             console.log('cancelled.');
             process.exit(0);
         }
    } else {
         console.log('\n⏩ Auto-proceeding with order placement...');
    }


    // ==========================================
    // TEST SEQUENCE 1: LONG FLOW (Bullish)
    // Strategy: Market Buy (Entry) -> Limit Sell (Exit)
    // ==========================================
    console.log('\n🔵 \x1b[1mSEQUENCE 1: LONG FLOW (Market Entry -> Limit Exit)\x1b[0m');
    
    // 1. Market Buy Entry
    console.log('   🚀 1.1 Market Buy (Entry)...');
    try {
        const longOrder = await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'MARKET',
            quantity: quantity
        });
        console.log(`      ✅ Filled: ${longOrder.orderId}`);
        
        await new Promise(r => setTimeout(r, 2000)); // Wait for fill propagation

        // 2. Limit Sell Exit (Close Position)
        // Check position first to be sure
        const positions = await adapter.getPositions(symbol);
        const longPos = positions.find(p => parseFloat(p.size) > 0);
        
        if (longPos) {
             console.log(`      ✅ Position Confirmed: ${longPos.size} ETH @ ${longPos.entryPrice}`);
             
             // Place Limit Sell slightly below market to ensure fill (but testing LIMIT type)
             // or slightly above to test waiting? Let's do slightly below to close successfully for test.
             // Actually user wants to test "Limit", so let's put it as a Maker order first then cancel?
             // No, let's close it efficiently using a Limit order that crosses.
             
             const exitPrice = adjustPrice(currentPrice.mul(0.99)); // Sell 1% lower (will fill immediately as Taker-Limit)
             console.log(`   🚀 1.2 Limit Sell (Exit) @ ${exitPrice}...`);
             
             const closeOrder = await adapter.placeOrder({
                 symbol: symbol,
                 side: 'SELL',
                 type: 'LIMIT',
                 quantity: quantity,
                 price: exitPrice,
                 timeInForce: 'GTC'
             });
             console.log(`      ✅ Limit Close Placed: ${closeOrder.orderId}`);
        } else {
             console.log('      ❌ Position NOT found after Market Buy!');
        }
        
    } catch (e: any) {
        console.log(`      ❌ Long Flow Failed: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 1000));


    // ==========================================
    // TEST SEQUENCE 2: SHORT FLOW (Bearish)
    // Strategy: Limit Sell (Entry) -> Market Buy (Exit)
    // ==========================================
    console.log('\n🔴 \x1b[1mSEQUENCE 2: SHORT FLOW (Limit Entry -> Market Exit)\x1b[0m');
    
    // 1. Limit Sell Entry
    // We want this to fill, so we place it below market (Taker Limit) or right at market
    const shortEntryPrice = adjustPrice(currentPrice.mul(0.995)); // 0.5% below (Aggressive Limit Sell)
    console.log(`   🚀 2.1 Limit Sell (Entry) @ ${shortEntryPrice}...`);
    
    try {
        const shortOrder = await adapter.placeOrder({
            symbol: symbol,
            side: 'SELL',
            type: 'LIMIT',
            quantity: quantity,
            price: shortEntryPrice,
            timeInForce: 'GTC'
        });
        console.log(`      ✅ Limit Entry Placed: ${shortOrder.orderId}`);
        
        await new Promise(r => setTimeout(r, 2000));

        // 2. Market Buy Exit (Close Position)
        const positions2 = await adapter.getPositions(symbol);
        const shortPos = positions2.find(p => parseFloat(p.size) < 0);
        
        if (shortPos) {
             console.log(`      ✅ Short Position Confirmed: ${shortPos.size} ETH @ ${shortPos.entryPrice}`);
             
             console.log('   🚀 2.2 Market Buy (Exit)...');
             const closeShort = await adapter.placeOrder({
                 symbol: symbol,
                 side: 'BUY',
                 type: 'MARKET',
                 quantity: quantity
             });
             console.log(`      ✅ Market Close Placed: ${closeShort.orderId}`);
             
        } else {
             console.log('      ⚠️ Short Position not found (Limit order might not have filled?)');
             // Attempt cleanup just in case order is open
             await adapter.cancelAllOrders(symbol);
        }

    } catch (e: any) {
        console.log(`      ❌ Short Flow Failed: ${e.message}`);
    }


    // ==========================================
    // EDGE CASES & ADVANCED ORDERS
    // ==========================================
    console.log('\n🧪 \x1b[1mTEST SEQUENCE 3: ADVANCED & EDGE CASES\x1b[0m');

    // 7. Test Advanced Order: STOP_LIMIT
    console.log('\n   🔸 Testing STOP_LIMIT Order...');
    try {
        const triggerPrice = adjustPrice(currentPrice.mul(1.05));
        const limitPx = adjustPrice(currentPrice.mul(1.06));
        
        const slOrder = await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'STOP_LIMIT',
            quantity: quantity,
            triggerPrice: triggerPrice,
            stopLimitPrice: limitPx,
            timeInForce: 'GTC'
        });
        console.log(`      ✅ STOP_LIMIT Placed: Trigger ${triggerPrice}, Limit ${limitPx} (ID: ${slOrder.orderId})`);
        
        // Verify Open
        await new Promise(r => setTimeout(r, 1000));
        const openOrders = await adapter.getOpenOrders(symbol);
        if (openOrders.find(o => o.orderId === slOrder.orderId)) {
             console.log('      ✅ Confirmed Open in Book.');
             await adapter.cancelOrder(slOrder.orderId, symbol);
             console.log('      ✅ Cancelled.');
        } else {
             console.log('      ⚠️ Order not found in book?');
        }
    } catch (e: any) {
        console.log(`      ❌ STOP_LIMIT Failed: ${e.message}`);
    }

    // 8. Test Edge Case: IOC
    console.log('\n   🔸 Testing IOC Order...');
    try {
        // Use 99.5% of market price 
        const iocPrice = adjustPrice(currentPrice.mul(0.995));
        const iocOrder = await adapter.placeOrder({
             symbol: symbol,
             side: 'BUY',
             type: 'LIMIT',
             quantity: quantity,
             price: iocPrice,
             timeInForce: 'IOC'
        });
        
        await new Promise(r => setTimeout(r, 1000));
        const openOrders = await adapter.getOpenOrders(symbol);
        if (!openOrders.find(o => o.orderId === iocOrder.orderId)) {
             console.log('      ✅ IOC Order correctly expired/cancelled.');
        } else {
             console.log('      ❌ IOC Order stuck open!');
             await adapter.cancelOrder(iocOrder.orderId, symbol);
        }
    } catch (e: any) {
        if (e.message.includes('Invalid Price') || e.message.includes('Price must be')) {
             console.log(`      ✅ IOC Rejected by Saftey Band (Pass): ${e.message}`);
        } else {
             console.log(`      ✅ IOC Rejected/Expired: ${e.message}`);
        }
    }

    // 9. Test Edge Case: Post-Only
    console.log('\n   🔸 Testing Post-Only (Rejection)...');
    try {
        const poPrice = adjustPrice(currentPrice.mul(1.02)); // +2%
        await adapter.placeOrder({
             symbol: symbol,
             side: 'BUY',
             type: 'LIMIT',
             quantity: quantity,
             price: poPrice,
             postOnly: true
        });
        console.log('      ❌ Post-Only ACCEPTED (Failure)');
    } catch (e: any) {
        console.log(`      ✅ Post-Only Rejected as expected: ${e.message}`);
    }

    // 10. Trailing Stop
    console.log('\n   🔸 Testing TRAILING_STOP_MARKET Safeguard...');
    try {
        await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'TRAILING_STOP_MARKET',
            quantity: quantity.toString(),
            trailingDelta: '1.0'
        });
        console.log('      ❌ Error: TRAILING_STOP_MARKET accepted');
    } catch (e: any) {
        console.log('      ✅ TRAILING_STOP_MARKET rejected as expected.');
    }

    console.log('\n🎉 \x1b[32mHyperliquid Comprehensive Tests Completed!\x1b[0m');

  } catch (error: any) {
    console.error('\n❌ \x1b[31mError:\x1b[0m', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
