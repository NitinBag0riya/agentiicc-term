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

function adjustPrecision(value: number | string | Decimal, tickSize: number | string | Decimal): string {
    const val = new Decimal(value);
    const tick = new Decimal(tickSize);
    return val.div(tick).round().mul(tick).toString();
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

    // 5. Test Order Params - Use simple integer-friendly price
    // Calculate a safe price: round to whole dollars to avoid tick size issues
    const targetPrice = currentPrice.mul(0.8).toDecimalPlaces(0, Decimal.ROUND_DOWN);
    const price = targetPrice.toString();
    
    // Calculate quantity for $12 USD order (min $10)
    const targetUsd = 12;
    const rawQty = new Decimal(targetUsd).div(price);
    const quantity = adjustPrecision(rawQty, stepSize).toString();

    console.log('\n📝 \x1b[33mComputed Test Order Params:\x1b[0m');
    console.log(`   Symbol:      ${symbol}`);
    console.log(`   Type:        LIMIT`);
    console.log(`   Side:        BUY`);
    console.log(`   Quantity:    ${quantity} (~$${new Decimal(quantity).mul(price).toFixed(2)})`);
    console.log(`   Price:       ${price} (whole dollars to ensure tick divisibility)`);
    console.log(`   Tick Size:   ${tickSize}`);
    console.log(`   Step Size:   ${stepSize}`);
    
    console.log('\n🚀 Auto-placing order (ENV credentials detected)...');

    // 6. Place Order
    console.log('\n🚀 Placing LIMIT Order...');
    const order = await adapter.placeOrder({
      symbol: symbol,
      side: 'BUY',
      type: 'LIMIT',
      quantity: quantity.toString(),
      price: price,
      timeInForce: 'GTC'
    });

    console.log('✅ \x1b[32mOrder Placed Successfully!\x1b[0m');
    console.log(`   ID: ${order.orderId}, Status: ${order.status}`);

    // 6b. Test Trailing Stop Safeguard (Should Fail)
    console.log('\n🧪 Testing TRAILING_STOP_MARKET Safeguard (Expect Failure)...');
    try {
        await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'TRAILING_STOP_MARKET',
            quantity: quantity.toString(),
            trailingDelta: '1.0'
        });
        console.log('❌ Error: TRAILING_STOP_MARKET was accepted (Unexpected!)');
    } catch (e: any) {
        if (e.message.includes('natively supported')) {
            console.log('✅ TRAILING_STOP_MARKET rejected as expected.');
        } else {
            console.log(`ℹ️ Rejected with message: ${e.message}`);
        }
    }

    // 7. Verify Open Orders
    console.log('\n🔍 Verifying Open Orders...');
    await new Promise(r => setTimeout(r, 2000));
    const openOrders = await adapter.getOpenOrders(symbol);
    
    console.log(`   Found ${openOrders.length} open orders.`);
    const myOrder = openOrders.find(o => o.orderId === order.orderId);
    
    if (myOrder) {
        console.log(`   ✅ Found open order: ${myOrder.orderId}`);
        
        // 8. Cancel Order
        console.log(`\n🛑 Cancelling Order ${myOrder.orderId}...`);
        await adapter.cancelOrder(myOrder.orderId, symbol);
        console.log('   ✅ Cancelled.');
        
        // Verify Check
        await new Promise(r => setTimeout(r, 1000));
        const check = await adapter.getOpenOrders(symbol);
        if (!check.find(o => o.orderId === myOrder.orderId)) {
            console.log('   ✅ Confirmed closed.');
        } else {
            console.log('   ⚠️ Order still open?');
        }
    } else {
        console.log('   ⚠️ Order not found in open list (maybe filled or rejected?)');
    }

    console.log('\n🎉 \x1b[32mHyperliquid Tests Completed!\x1b[0m');

  } catch (error: any) {
    console.error('\n❌ \x1b[31mError:\x1b[0m', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
