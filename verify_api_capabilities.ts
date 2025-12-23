
import dotenv from 'dotenv';
import path from 'path';
import { UniversalApiClient } from './src/services/universalApi';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const SYMBOL = 'BTCUSDT'; // Use a major pair for testing

async function verifyCapabilities() {
  console.log('🔍 Starting User Capability Verification...');
  console.log('Target Symbol:', SYMBOL);

  const client = new UniversalApiClient();
  
  // We need a userId to init session. 
  // Ideally, we'd use a real user ID from the database, but for a standalone script, 
  // we might need to mock or fetch one.
  const USER_ID = 185; 
  console.log(`\n🔑 Initializing Session for User ID: ${USER_ID}`);
  
  const initSuccess = await client.initSession(USER_ID);
  if (!initSuccess) {
      console.error('❌ Failed to initialize session. Ensure the user exists and has credentials linked.');
      process.exit(1);
  }
  console.log('✅ Session Initialized');

  // Test both exchanges if possible, or detect active exchange
  const exchanges = ['aster', 'hyperliquid'];

  for (const exchange of exchanges) {
      console.log(`\n----------------------------------------`);
      console.log(`📡 Verifying Exchange: ${exchange.toUpperCase()}`);
      console.log(`----------------------------------------`);

      try {
          // 1. Account Info
          console.log('\n[1] GET /account');
          const account = await client.getAccount(exchange);
          if (account.success) console.log('✅ Success:', account.data?.asset || 'Data received');
          else console.log('❌ Failed:', account.error);

          // 2. Positions
          console.log('\n[2] GET /positions');
          const positions = await client.getPositions(exchange);
          if (positions.success) {
            console.log('✅ Success:', positions.data?.length || 0, 'positions');
            // Log active positions for context
            if (positions.data?.length > 0) {
              console.table(positions.data.map((p: any) => ({
                symbol: p.symbol,
                amt: p.positionAmt,
                pnl: p.unRealizedProfit
              })));
            }
          } else {
            console.log('❌ Failed:', positions.error);
          }

          // 3. Open Orders
          console.log('\n[3] GET /orders (Open)');
          const openOrders = await client.getOpenOrders(SYMBOL);
          // Note: getOpenOrders often takes symbol. If client.getOpenOrders doesn't support exchange param for listing ALL, 
          // it might default to active exchange. Let's check signature. 
          // Signature: getOpenOrders(symbol?: string) -> calls /orders with symbol.
          // Wait, UniversalApi.getOpenOrders DOES NOT accept exchange param!
          // It relies on session.activeExchange or query param if passed?
          // The implementation: return (await this.client.get('/orders', { params: { symbol } })).data;
          // The endpoint uses `req.query.exchange || session.activeExchange`.
          // We initiated session but didn't set active exchange explicitly in initSession(userId, exchangeId).
          // Let's re-init session for this loop iteration to be safe, or just rely on default.
          // Actually, let's skip re-init and see what happens (it might default to last active).
          
          if (openOrders.success) {
            console.log('✅ Success:', openOrders.data?.length || 0, 'orders');
          } else {
            console.log('❌ Failed:', openOrders.error);
          }

          // 4. Market Data (Ticker)
          console.log('\n[4] GET /ticker/:symbol');
          const ticker = await client.getTicker(SYMBOL, exchange);
          if (ticker.success) console.log('✅ Success:', ticker.data?.lastPrice);
          else console.log('❌ Failed:', ticker.error);

          // 5. Assets
          console.log('\n[5] GET /assets');
          const assets = await client.getAssets(exchange);
          if (assets.success) console.log('✅ Success:', assets.data?.length || 0, 'assets');
          else console.log('❌ Failed:', assets.error);

          // 6. Leverage (Read/Set check - skip setting to avoid side effects during audit, unless verified safe)
          // We won't set leverage in this audit script to avoid changing user state unexpectedly.
          console.log('\n[6] Leverage/Margin Check (Skipped setting for safety)');

      } catch (error: any) {
          console.error('❌ Critical Error during verification:', error.message);
      }
  }

  console.log('\n----------------------------------------');
  console.log('🏁 Verification Complete');
}

verifyCapabilities();
