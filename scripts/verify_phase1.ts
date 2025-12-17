
import { fetch } from 'bun';

const BASE_URL = 'http://localhost:3000';

async function run() {
    console.log('🚀 Starting Phase 1 Verification...');

    // 1. Create User
    console.log('\n👤 Creating User...');
    const userRes = await fetch(`${BASE_URL}/user`, {
        method: 'POST',
        body: JSON.stringify({ telegramId: 123456789, username: 'test_user_phase1' }),
        headers: { 'Content-Type': 'application/json' },
    });
    const userData = await userRes.json();
    console.log('User Response:', JSON.stringify(userData, null, 2));

    if (!userData.success) {
        console.error('❌ Failed to create user');
        return;
    }
    const userId = userData.data.id;

    // 2. Link Aster
    console.log('\n🔗 Linking Aster...');
    const linkRes = await fetch(`${BASE_URL}/user/credentials`, {
        method: 'POST',
        body: JSON.stringify({
            userId,
            exchange: 'aster',
            apiKey: 'mock_api_key',
            apiSecret: 'mock_api_secret'
        }),
        headers: { 'Content-Type': 'application/json' },
    });
    console.log('Link Response:', await linkRes.json());

    // 3. Create Session
    console.log('\n🔐 Creating Session...');
    const sessionRes = await fetch(`${BASE_URL}/auth/session`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: { 'Content-Type': 'application/json' },
    });
    const sessionData = await sessionRes.json();
    console.log('Session Response:', sessionData);

    if (!sessionData.success) {
        console.error('❌ Failed to create session');
        return;
    }
    const token = sessionData.token;

    // 4. Get Account (Aster)
    console.log('\n💰 Getting Account (Aster)...');
    const accountRes = await fetch(`${BASE_URL}/account?exchange=aster`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const accountData = await accountRes.json();
    console.log('Account Data Structure:', JSON.stringify(accountData, null, 2));

    // 5. Get Ticker
    console.log('\n📈 Getting Ticker (ETHUSDT)...');
    const tickerRes = await fetch(`${BASE_URL}/ticker/ETHUSDT?exchange=aster`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('Ticker Data:', await tickerRes.json());

}

run();
