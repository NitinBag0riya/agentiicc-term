
const BASE_URL = 'http://localhost:3000';

async function main() {
    console.log('🔍 Verifying Credential API Endpoints...');

    try {
        // 1. Create/Get User
        const telegramId = 998877; // New unique ID
        console.log(`\n1️⃣  Creating User (Telegram ID: ${telegramId})...`);
        const userRes = await fetch(`${BASE_URL}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId, username: 'api_test_user' })
        });
        const userData: any = await userRes.json();
        if (!userData.success) throw new Error(`User Creation Failed: ${JSON.stringify(userData)}`);
        
        const userId = userData.data.id;
        console.log(`   ✅ User Created: ID ${userId}`);

        // 2. Link Aster Credentials
        console.log('\n2️⃣  Linking Aster Credentials...');
        const asterRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                exchange: 'aster',
                apiKey: 'test-aster-key',
                apiSecret: 'test-aster-secret'
            })
        });
        const asterData: any = await asterRes.json();
        if (!asterData.success) throw new Error(`Aster Link Failed: ${JSON.stringify(asterData)}`);
        console.log('   ✅ Aster Linked');

        // 3. Link Hyperliquid Credentials
        console.log('\n3️⃣  Linking Hyperliquid Credentials...');
        const hlRes = await fetch(`${BASE_URL}/user/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                exchange: 'hyperliquid',
                apiKey: '0xAddress', // Use proper format if validation exists, but mock is ok for now
                apiSecret: '0xPrivateKey'
            })
        });
        const hlData: any = await hlRes.json();
        if (!hlData.success) throw new Error(`Hyperliquid Link Failed: ${JSON.stringify(hlData)}`);
        console.log('   ✅ Hyperliquid Linked');

        // 4. List Linked Exchanges
        console.log('\n4️⃣  Listing Linked Exchanges...');
        const listRes = await fetch(`${BASE_URL}/user/exchanges?userId=${userId}`);
        const listData: any = await listRes.json();
        if (!listData.success) throw new Error(`List Exchanges Failed: ${JSON.stringify(listData)}`);
        
        console.log('   ✅ Exchanges Found:', listData.data);
        const exchanges = listData.data;
        if (!exchanges.includes('aster') || !exchanges.includes('hyperliquid')) {
            throw new Error('List did not return both exchanges');
        }

        console.log('\n✨ CREDENTIAL API VERIFIED!');
    } catch (e: any) {
        console.error(`\n❌ VERIFICATION FAILED: ${e.message}`);
        process.exit(1);
    }
}

main();
