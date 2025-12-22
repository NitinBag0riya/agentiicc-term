/**
 * Test Redis and PostgreSQL connections
 * Run: bun run new-src/db/test-connections.ts
 */
import dotenv from 'dotenv';
import { connectRedis, disconnectRedis, getRedis } from './redis';
import { connectPostgres, disconnectPostgres, query, initSchema } from './postgres';

dotenv.config();

async function testConnections() {
  console.log('🧪 Testing Database Connections...\n');

  try {
    // Test Redis
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📡 Testing Redis Connection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await connectRedis();
    const redis = getRedis();

    // Test SET/GET
    await redis.set('test:connection', 'Hello from Redis!', 'EX', 10);
    const value = await redis.get('test:connection');
    console.log('[Redis] Test value:', value);

    // Test session-like data
    const sessionData = {
      userId: 123,
      isLinked: true,
      timestamp: Date.now(),
    };
    await redis.set('session:test', JSON.stringify(sessionData), 'EX', 60);
    const session = await redis.get('session:test');
    console.log('[Redis] Test session:', JSON.parse(session!));

    console.log('[Redis] ✅ All tests passed\n');

    // Test PostgreSQL
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐘 Testing PostgreSQL Connection');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await connectPostgres();

    // Initialize schema
    await initSchema();

    // Test user creation
    const testTelegramId = Math.floor(Math.random() * 1000000);
    await query(
      `INSERT INTO users (telegram_id, username) VALUES ($1, $2)
       ON CONFLICT (telegram_id) DO NOTHING`,
      [testTelegramId, 'test_user']
    );

    // Test user query
    const users = await query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [testTelegramId]
    );
    console.log('[Postgres] Test user:', users[0]);

    // Test API credentials (dummy encrypted data)
    if (users[0]) {
      await query(
        `INSERT INTO api_credentials (user_id, api_key_encrypted, api_secret_encrypted)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()`,
        [users[0].id, 'encrypted_key_test', 'encrypted_secret_test']
      );

      const creds = await query(
        'SELECT * FROM api_credentials WHERE user_id = $1',
        [users[0].id]
      );
      console.log('[Postgres] Test credentials:', creds[0]);
    }

    console.log('[Postgres] ✅ All tests passed\n');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ CONNECTION TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Redis: Connected and working');
    console.log('✅ PostgreSQL: Connected and working');
    console.log('✅ Schema: Initialized');
    console.log('\n🚀 Ready to build the bot!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await disconnectRedis();
    await disconnectPostgres();
  }
}

// Run tests
testConnections();
