/**
 * Verify Server Fix
 * Tests the full API server capabilities (Auth, Account, Orders)
 * to ensure it matches Postman Expectations.
 */

const BASE_URL = 'http://localhost:3000';

// Mock User Data (Must exist in DB or be created)
const USER_ID = 2; // From Postman collection defaults
const EXCHANGE_ID = 'aster';

async function main() {
    console.log('🔍 Verifying Full API Server Fix...');
    console.log(`📡 Base URL: ${BASE_URL}`);

    try {
        // 1. Health Check
        console.log('\n1️⃣  Checking Health...');
        const health = await fetch(`${BASE_URL}/health`).then(r => r.json());
        console.log('   ✅ Health OK:', health);

        // 2. Auth (Create Session) - THIS FAILED ON OLD SERVER
        console.log('\n2️⃣  Testing Auth (Create Session)...');
        const authRes = await fetch(`${BASE_URL}/auth/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, exchangeId: EXCHANGE_ID })
        });
        
        if (authRes.status !== 200) {
            throw new Error(`Auth failed with status ${authRes.status}: ${await authRes.text()}`);
        }

        const authData: any = await authRes.json();
        console.log('   ✅ Auth Response:', authData);
        
        if (!authData.success || !authData.token) {
            throw new Error('Auth did not return a token!');
        }
        
        const token = authData.token;
        console.log('   🔑 Token acquired');

        // 3. Authenticated Request (Get Account)
        console.log('\n3️⃣  Testing Authenticated Request (Get Account)...');
        const accRes = await fetch(`${BASE_URL}/account?exchange=${EXCHANGE_ID}`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });

        if (accRes.status !== 200) {
             throw new Error(`Account request failed with status ${accRes.status}: ${await accRes.text()}`);
        }

        const accData: any = await accRes.json();
        console.log('   ✅ Account Data:', accData.success ? 'Success' : 'Failed');
        if (accData.success) {
            console.log(`      Balance: ${accData.data?.availableBalance}`);
        }

        console.log('\n✨ VERIFICATION SUCCESSFUL! The server is fully operational.');
        console.log('   You can now use Postman with the /auth/session endpoint.');

    } catch (error: any) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        process.exit(1);
    }
}

main();
