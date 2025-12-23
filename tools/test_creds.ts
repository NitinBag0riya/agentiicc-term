
import { createInterface } from 'readline';
import { UniversalApiClient } from '../src/services/universalApi';
import dotenv from 'dotenv';

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
  console.log('🔍 Universal API Credentials Debug Tool');
  console.log('------------------------------------');
  console.log('NOTE: Ensure the backend (agentiicc-term) is running on port 3001!');
  
  try {
    const exchange = (await ask('Exchange (aster/hyperliquid) [aster]: ')) || 'aster';
    const apiKey = await ask('Enter API Key: ');
    const apiSecret = await ask('Enter API Secret: ');
    
    // Simulate a test user
    const testUserId = 77777;

    const client = new UniversalApiClient();
    
    console.log('\n📡 Testing Link Credentials...');
    // linkCredentials(userId, exchange, credentials)
    const linkRes = await client.linkCredentials(testUserId, exchange, { apiKey, apiSecret });
    
    if (linkRes.success) {
        console.log('✅ Link Success!');
        
        console.log('Initializing Session...');
        const sessionInit = await client.initSession(testUserId);
        if (!sessionInit) throw new Error('Session Init Failed');
        
        console.log('fetching Account...');
        // getAccount(exchange?) - uses session's default or we pass exchange
        // UniversalApiClient.getAccount passes { exchange } in params
        const accRes = await client.getAccount(exchange);
        if (accRes.success) {
             console.log('✅ Account Info:', JSON.stringify(accRes.data, null, 2));
        } else {
             console.error('❌ Get Account Failed:', accRes.error);
        }
        
    } else {
        console.error('❌ Link Failed:', linkRes.error);
        if (linkRes.error?.includes('ECONNREFUSED')) {
            console.error('\n⚠️  Is the Backend Running? Could not connect to localhost:3001');
        }
    }

  } catch (err: any) {
    console.error('Fatal Error:', err.message);
    if (err.code === 'ECONNREFUSED') {
         console.error('\n⚠️  Is the Backend Running? Could not connect to localhost:3001');
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
