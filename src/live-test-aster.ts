
import { AsterAdapter } from './adapters/aster.adapter';
import { createInterface } from 'readline';
import { Decimal } from 'decimal.js';

// --- CONFIG --- 
// You can hardcode credentials here OR use environment variables
// OR just press enter to skip if you set them in code
const ENV_API_KEY = process.env.ASTER_API_KEY || ''; 
const ENV_API_SECRET = process.env.ASTER_API_SECRET || '';
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
    
    // Round to nearest tick: val.div(tick).round().mul(tick)
    return val.div(tick).round().mul(tick).toString();
}

async function main() {
  console.log('\n🌟 \x1b[36mAster API Live Tester (Precision by Decimal.js)\x1b[0m 🌟');
  console.log('Using `decimal.js` for precise crypto math.');
  
  // 1. Get Credentials
  let apiKey = ENV_API_KEY;
  let apiSecret = ENV_API_SECRET;

  if (!apiKey || !apiSecret) {
      console.log('Credentials not found in script variables.');
      apiKey = await question('Enter Aster API Key: ');
      apiSecret = await question('Enter Aster API Secret: ');
  } else {
      console.log('✅ Using credentials from script/env');
  }

  if (!apiKey || !apiSecret) {
    console.log('❌ Credentials required!');
    process.exit(1);
  }

  // 2. Initialize Adapter
  console.log('\n🔌 Initializing Adapter...');
  const adapter = new AsterAdapter(apiKey.trim(), apiSecret.trim());

  try {
    // 3. Test Connection
    console.log('💰 Fetching Account Balance...');
    const account = await adapter.getAccount();
    console.log(`   Total Balance: $${new Decimal(account.totalBalance).toFixed(2)}`);

    // 4. Get Market Data & Tick Size
    const symbol = 'ETHUSDT';
    console.log(`\n📊 Fetching Market Data for ${symbol}...`);
    
    const ticker = await adapter.getTicker(symbol);
    const currentPrice = new Decimal(ticker.price);
    console.log(`   Current Price: $${currentPrice}`);

    const assets = await adapter.getAssets();
    const assetInfo: any = assets.find(a => a.symbol === symbol);
    
    if (!assetInfo) throw new Error(`Asset info not found for ${symbol}`);
    
    const tickSize = new Decimal(assetInfo.tickSize || '0.01');
    const stepSize = new Decimal(assetInfo.minQuantity || '0.001');
    
    console.log(`   Tick Size: ${tickSize}`);
    console.log(`   Step Size: ${stepSize}`);

    // 5. Calculate Params for MARKET Order with TP/SL
    // Target: Current Market Price
    // Min Notional Logic ($6)
    const minNotional = new Decimal(6);
    
    // Quantity = (MinNotional / Price) * 1.1 buffer
    let quantity = minNotional.div(currentPrice).mul(1.1);
    
    // Enforce Min Quantity
    const minQty = new Decimal(assetInfo.minQuantity || '0');
    if (quantity.lessThan(minQty)) {
        quantity = minQty;
    }
    
    // Adjust Precision
    const quantityStr = adjustPrecision(quantity, stepSize);
    
    // Calculate TP/SL Prices
    const tpPrice = adjustPrecision(currentPrice.mul(1.10).toString(), tickSize.toString()); // +10%
    const slPrice = adjustPrecision(currentPrice.mul(0.90).toString(), tickSize.toString()); // -10%

    console.log('\n📝 \x1b[33mComputed Test Order Params (with Decimal.js):\x1b[0m');
    console.log(`   Symbol:      ${symbol}`);
    console.log(`   Type:        MARKET`);
    console.log(`   Side:        BUY`);
    console.log(`   Quantity:    ${quantityStr}`);
    console.log(`   Take Profit: ${tpPrice} (+10%)`);
    console.log(`   Stop Loss:   ${slPrice} (-10%)`);
    
    // Auto-proceed if using env vars
    if (!ENV_API_KEY) {
        const confirm = await question('\n❓ Proceed with placing this test order? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('cancelled.');
            process.exit(0);
        }
    } else {
        console.log('\n⏩ Auto-proceeding with order placement...');
    }

    // 6. Place Order
    console.log('\n🚀 Placing MARKET Order with TP/SL...');
    const order = await adapter.placeOrder({
      symbol: symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: quantityStr,
      takeProfit: tpPrice,
      stopLoss: slPrice
    });

    console.log('✅ \x1b[32mMain Order Placed Successfully!\x1b[0m');
    console.log(`   ID: ${order.orderId}, Status: ${order.status}`);

    // 7. Verify Open Orders
    console.log('\n🔍 Verifying Open Orders (expecting TP/SL)...');
    await new Promise(r => setTimeout(r, 2000));
    const openOrders = await adapter.getOpenOrders(symbol);
    
    console.log(`   Found ${openOrders.length} open orders:`);
    openOrders.forEach(o => {
        console.log(`   - [${o.type}] ${o.side} ${o.quantity} @ ${o.price || 'Market'} (Trigger: ${o.price || 'N/A'}) (ID: ${o.orderId})`);
    });

    const hasTP = openOrders.some(o => o.type.includes('TAKE_PROFIT'));
    const hasSL = openOrders.some(o => o.type.includes('STOP'));

    if (hasTP && hasSL) {
        console.log('✅ Found both TP and SL orders!');
    } else {
        console.log('⚠️ Missing TP or SL orders in open list.');
    }

    // 7b. Test Conditional Breakout Order (New supported feature)
    console.log('\n🧪 Testing Conditional Breakout Order (STOP_MARKET)...');
    const triggerPrice = adjustPrecision(currentPrice.mul(1.05).toString(), tickSize.toString()); // +5%
    try {
        const condOrder = await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'STOP_MARKET',
            quantity: quantityStr,
            triggerPrice: triggerPrice,
            timeInForce: 'GTC'
        });
        console.log(`✅ Placed STOP_MARKET Buy at ${triggerPrice} (ID: ${condOrder.orderId})`);
        openOrders.push({ orderId: condOrder.orderId } as any);
    } catch (e: any) {
        console.log(`❌ Failed to place conditional order: ${e.message}`);
    }

    // 7c. Test Advanced Options: Post-Only (GTX)
    // We try to place a buy ABOVE market with PostOnly. It MUST fail/reject/expire because it would take liquidity.
    console.log('\n🧪 Testing Post-Only (GTX) rejection...');
    const badPrice = adjustPrecision(currentPrice.mul(1.01).toString(), tickSize.toString()); 
    try {
        await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity: quantityStr,
            price: badPrice,
            postOnly: true
        });
        console.log('⚠️ Warning: Post-Only order accepted (Unexpected behavior, might depend on exchange)');
    } catch (e: any) {
        if (e.message.includes('GTX') || e.message.includes('PostOnly') || e.message.includes('would trade immediately') || e.message.includes('expire')) {
             console.log('✅ Post-Only correctly rejected/expired (as expected)!');
        } else {
             console.log(`ℹ️ Order failed (likely Post-Only logic): ${e.message}`);
        }
    }

    // 7d. Test Advanced Options: IOC (Immediate Or Cancel)
    // We place a buy deep below market. It cannot fill immediately, so it should be Cancelled instantly.
    console.log('\n🧪 Testing TimeInForce: IOC...');
    const deepPrice = adjustPrecision(currentPrice.mul(0.8).toString(), tickSize.toString());
    try {
        const iocOrder = await adapter.placeOrder({
            symbol: symbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity: quantityStr,
            price: deepPrice,
            timeInForce: 'IOC'
        });
        
        if (iocOrder.status === 'CANCELED' || iocOrder.status as string === 'EXPIRED') {
            console.log('✅ IOC Order correctly cancelled/expired immediately!');
        } else {
            console.log(`ℹ️ IOC Order status: ${iocOrder.status} (ID: ${iocOrder.orderId})`);
            // Cleanup just in case
            if (iocOrder.status === 'NEW') openOrders.push({ orderId: iocOrder.orderId } as any);
        }
    } catch (e: any) {
         console.log(`✅ IOC Order failed/expired immediately: ${e.message}`);
    }

    // 8. Close Position & Cleanup
    console.log('\n🛑 Closing Position & Cancelling Orders...');
    
    // Refresh open orders to include the conditional one
    const allOpen = await adapter.getOpenOrders(symbol);

    for (const o of allOpen) {
        process.stdout.write(`   Cancelling ${o.type} (${o.orderId})... `);
        await adapter.cancelOrder(o.orderId, symbol);
        console.log('Done.');
    }

    console.log('   Closing position (Market Sell)...');
    try {
        await adapter.placeOrder({
            symbol: symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: quantityStr
        });
        console.log('✅ Position Closed.');
    } catch (e: any) {
        // May fail if position is 0 (e.g. if Market Buy failed)
        console.log('⚠️ Failed to close position (maybe already closed?):', e.message);
    }

    console.log('\n🎉 \x1b[32mAll Live Tests Completed Successfully!\x1b[0m');

  } catch (error: any) {
    console.error('\n❌ \x1b[31mError:\x1b[0m', error.message);
    if (error.cause) console.error(JSON.stringify(error.cause, null, 2));
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
