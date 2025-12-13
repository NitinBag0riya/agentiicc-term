
import { connectPostgres, query } from './db/postgres';

// Accept URL from arg or env
const BASE_URL = process.argv[2] || process.env.API_URL || 'http://localhost:3000';
let USER_ID = 2; 
const SYMBOL = 'ETHUSDT';

async function getValidUserForExchange(exchangeId: string): Promise<number | null> {
    const res = await query(
        `SELECT u.id 
         FROM users u 
         JOIN api_credentials ac ON u.id = ac.user_id 
         WHERE ac.exchange_id = $1
         LIMIT 1`,
        [exchangeId]
    );
    return res.rows.length > 0 ? res.rows[0].id : null;
}

async function getMarketPrice(exchange: string): Promise<number> {
    console.log(`Debug: Fetching ticker for ${exchange}...`);
    const res = await fetch(`${BASE_URL}/ticker/ETHUSDT?exchange=${exchange}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Invalid response (not JSON): ${text.substring(0, 100)}...`);
    }

    const data: any = await res.json();
    if (!data.success) throw new Error(`Failed to get ticker for ${exchange}: ${data.error}`);
    return parseFloat(data.data.price);
}

async function getTickSize(exchange: string, symbol: string): Promise<number> {
    console.log(`Debug: Fetching assets for ${exchange}...`);
    const res = await fetch(`${BASE_URL}/assets?exchange=${exchange}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    const data: any = await res.json();
    if (!data.success) throw new Error(`Failed to get assets for ${exchange}`);
    
    // Normalize symbol search
    const asset = data.data.find((a: any) => a.symbol === symbol || a.symbol === symbol.replace('USDT', ''));
    if (!asset) {
        console.warn(`⚠️ Asset ${symbol} not found in assets list, defaulting to 0.01`);
        return 0.01;
    }
    return parseFloat(asset.tickSize);
}

function roundToTick(price: number, tickSize: number): number {
    const inverse = 1 / tickSize;
    return Math.round(price * inverse) / inverse;
}

async function generateTestOrders(exchange: string) {
    const market = await getMarketPrice(exchange);
    const tickSize = await getTickSize(exchange, SYMBOL);
    
    console.log(`   📊 Market Price: ${market} | Tick Size: ${tickSize}`);

    const limitBuy = roundToTick(market * 0.9, tickSize);
    const limitSell = roundToTick(market * 1.1, tickSize);
    const iocBuy = roundToTick(market * 1.005, tickSize); 
    const stopTrigger = roundToTick(market * 0.95, tickSize);
    const tpTrigger = roundToTick(market * 1.05, tickSize);
    const stopLimitPrice = roundToTick(stopTrigger - (tickSize * 100), tickSize);

    const QTY = exchange === 'hyperliquid' ? '0.005' : '0.002';
    
    return [
        { name: 'LIMIT BUY', body: { symbol: SYMBOL, side: 'BUY', type: 'LIMIT', quantity: QTY, price: limitBuy.toString() } },
        { name: 'LIMIT SELL', body: { symbol: SYMBOL, side: 'SELL', type: 'LIMIT', quantity: QTY, price: limitSell.toString() } },
        { name: 'MARKET BUY', body: { symbol: SYMBOL, side: 'BUY', type: 'MARKET', quantity: QTY }, isIOC: true },
        { name: 'IOC BUY', body: { symbol: SYMBOL, side: 'BUY', type: 'LIMIT', quantity: QTY, price: iocBuy.toString(), timeInForce: 'IOC' }, isIOC: true },
        { name: 'POST_ONLY BUY', body: { symbol: SYMBOL, side: 'BUY', type: 'LIMIT', quantity: QTY, price: limitBuy.toString(), postOnly: true } },
        { name: 'STOP_MARKET SELL', body: { symbol: SYMBOL, side: 'SELL', type: 'STOP_MARKET', quantity: QTY, triggerPrice: stopTrigger.toString() } },
        { name: 'STOP_LIMIT SELL', body: { symbol: SYMBOL, side: 'SELL', type: 'STOP_LIMIT', quantity: QTY, price: stopLimitPrice.toString(), triggerPrice: stopTrigger.toString() } },
        { name: 'TAKE_PROFIT_MARKET SELL', body: { symbol: SYMBOL, side: 'SELL', type: 'TAKE_PROFIT_MARKET', quantity: QTY, triggerPrice: tpTrigger.toString() } },
    ];
}

async function authenticate(exchange: string) {
    console.log(`Debug: Authenticating ${exchange}...`);
    const res = await fetch(`${BASE_URL}/auth/session`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ userId: USER_ID, exchangeId: exchange })
    });
    const data: any = await res.json();
    if (!data.success) throw new Error(`Auth failed for ${exchange}: ${JSON.stringify(data)}`);
    return data.token;
}

async function runTestsForExchange(exchange: string) {
    console.log(`\n\n════════════════════════════════════════`);
    console.log(`🧪 Testing Exchange: ${exchange.toUpperCase()}`);
    console.log(`════════════════════════════════════════`);

    try {
        const token = await authenticate(exchange);
        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true' 
        };
        
        const orders = await generateTestOrders(exchange);

        // 1. Run Standard Types
        for (const test of orders) {
            console.log(`   👉 ${test.name.padEnd(25)} ... `);
            const payload = { ...test.body, exchange };
            const res = await fetch(`${BASE_URL}/order`, { method: 'POST', headers, body: JSON.stringify(payload) });
            const data: any = await res.json();
            
            if (data.success) {
                console.log(`✅ Success (ID: ${data.data.orderId})`);
                if (!test.isIOC && data.data.status !== 'FILLED' && data.data.status !== 'EXPIRED') {
                    await fetch(`${BASE_URL}/order/${data.data.orderId}?symbol=${SYMBOL}&exchange=${exchange}`, { method: 'DELETE', headers });
                }
            } else {
                console.log(`❌ FAILED: ${data.error}`);
            }
            await new Promise(r => setTimeout(r, 500));
        }

        // 2. Trailing Stop
        process.stdout.write(`   👉 TRAILING_STOP        ... `);
        const tsRes = await fetch(`${BASE_URL}/order`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                symbol: SYMBOL, side: 'SELL', type: 'TRAILING_STOP_MARKET', 
                quantity: '0.005', callbackRate: '2', exchange 
            })
        });
        const tsData: any = await tsRes.json();
        
        if (exchange === 'aster') {
            if (tsData.success) {
                console.log(`✅ Success (ID: ${tsData.data.orderId})`);
                await fetch(`${BASE_URL}/order/${tsData.data.orderId}?symbol=${SYMBOL}&exchange=${exchange}`, { method: 'DELETE', headers });
            } else {
                console.log(`❌ FAILED: ${tsData.error}`);
            }
        } else {
             if (!tsData.success && tsData.error.includes('not natively supported')) {
                 console.log(`✅ Correctly Rejected (Not Supported)`);
            } else {
                 console.log(`⚠️ Unexpected result: ${JSON.stringify(tsData)}`);
            }
        }
    } catch (e: any) {
        console.error(`\n❌ Error verifying ${exchange}:`, e.message);
    }
}

async function main() {
    await connectPostgres();
    console.log(`🚀 Verification Script Target: ${BASE_URL}`);
    
    const asterUser = await getValidUserForExchange('aster');
    if (asterUser) {
        USER_ID = asterUser;
        await runTestsForExchange('aster');
    }

    const hlUser = await getValidUserForExchange('hyperliquid');
    if (hlUser) {
        USER_ID = hlUser;
        await runTestsForExchange('hyperliquid');
    }
    
    console.log('\n🏁 Verification Finished.');
    process.exit(0);
}

main();
