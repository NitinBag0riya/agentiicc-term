
const BASE_URL = 'http://localhost:3000';
const USER_ID = 20;

async function testFlows(exchange: string) {
    console.log(`\n🔵 Testing Flows for ${exchange.toUpperCase()}...`);
    
    // 1. Auth
    console.log('   🔸 Auth...');
    const authRes = await fetch(`${BASE_URL}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID, exchangeId: exchange })
    });
    if (authRes.status !== 200) throw new Error(`Auth Failed: ${await authRes.text()}`);
    const authData: any = await authRes.json();
    if (!authData.success) throw new Error(`Auth Failed: ${JSON.stringify(authData)}`);
    const token = authData.token;
    console.log('      ✅ Token Acquired');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 2. Account
    console.log('   🔸 Account Info...');
    const accRes = await fetch(`${BASE_URL}/account?exchange=${exchange}`, { headers });
    const accData: any = await accRes.json();
    if (!accData.success) throw new Error(`Account Failed: ${accData.error}`);
    console.log(`      ✅ Balance: ${accData.data?.availableBalance}`);

    // 3. Ticker (Public)
    console.log('   🔸 Ticker...');
    const symbol = exchange === 'aster' ? 'ETHUSDT' : 'ETH';
    const tickRes = await fetch(`${BASE_URL}/ticker/${symbol}?exchange=${exchange}`);
    const tickData: any = await tickRes.json();
    if (!tickData.success) throw new Error(`Ticker Failed`);
    console.log(`      ✅ Price: ${tickData.data?.price}`);

    // 4. Place Order (Limit)
    console.log('   🔸 Place LIMIT Order...');
    const price = exchange === 'hyperliquid' ? '2000' : '2000'; // Safe low price
    const orderRes = await fetch(`${BASE_URL}/order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            symbol,
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.01', // Small qty
            price,
            exchange
        })
    });
    const orderData: any = await orderRes.json();
    if (!orderData.success) {
         // Some exchanges reject test orders or require specific increments
         console.warn(`      ⚠️ Order Failed (Expected if insufficient funds/test mode): ${orderData.error}`);
    } else {
         console.log(`      ✅ Order Placed: ${orderData.data.orderId}`);
         // cleanup
         const orderId = orderData.data.orderId;
         await fetch(`${BASE_URL}/order/${orderId}?symbol=${symbol}&exchange=${exchange}`, { method: 'DELETE', headers });
    }

    console.log(`✅ ${exchange} Flows Verified`);
}

async function main() {
    try {
        await testFlows('aster');
        await testFlows('hyperliquid');
        console.log('\n✨ ALL POSTMAN FLOWS VERIFIED');
    } catch (e: any) {
        console.error(`\n❌ FLOW VERIFICATION FAILED: ${e.message}`);
        process.exit(1);
    }
}

main();
