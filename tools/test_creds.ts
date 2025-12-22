
import { createInterface } from 'readline';
import { createAsterClient } from '../src/aster/client';
import { getRedis, connectRedis, disconnectRedis } from '../src/db/redis';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log('🔍 Aster Credentials Debug Tool');
  console.log('-------------------------------');
  
  try {
    const apiKey = await ask('Enter API Key: ');
    if (!apiKey) throw new Error('API Key is required');
    
    const apiSecret = await ask('Enter API Secret: ');
    if (!apiSecret) throw new Error('API Secret is required');

    console.log('\nConnecting to Redis...');
    await connectRedis(process.env.REDIS_URL);
    const redis = getRedis();

    console.log('Initializing Aster Client...');
    const client = await createAsterClient({
      baseUrl: process.env.ASTER_BASE_URL || 'https://fapi.asterdex.com',
      apiKey,
      apiSecret,
      redis
    });

    console.log('📡 Testing Account Info (GET /fapi/v1/account)...');
    try {
      const account = await client.getAccountInfo();
      console.log('\n✅ Success! Verification passed.');
      console.log('Account Alias:', account.feeTier);
      console.log('Can Trade:', account.canTrade);
    } catch (error: any) {
      console.error('\n❌ Verification Failed!');
      console.error('-----------------------');
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Error Code:', error.response?.data?.code || 'N/A');
        console.error('Error Msg:', error.response?.data?.msg || 'N/A');
        console.error('Full Response:', JSON.stringify(error.response?.data, null, 2));
      } else {
        console.error('Error:', error.message);
      }
    }

  } catch (err: any) {
    console.error('Fatal Error:', err.message);
  } finally {
    await disconnectRedis();
    rl.close();
    process.exit(0);
  }
}

main();
