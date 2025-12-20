/**
 * Database Migration: Fix Multi-Exchange Support
 * Run with: bun run migrate-db.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function migrate() {
  console.log('🔄 Database Migration: Multi-Exchange Support');
  console.log('==============================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('📊 Connecting to Supabase...');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    console.log('🔧 Checking current constraints...');
    
    // Check existing constraints
    const constraintsResult = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'api_credentials'::regclass
      AND contype = 'u'
    `);

    console.log('Current unique constraints:');
    constraintsResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name} (${row.constraint_type})`);
    });
    console.log('');

    // Drop old constraints
    console.log('🗑️  Dropping old constraints...');
    
    const constraintsToDrop = [
      'api_credentials_user_id_key',
      'apicredentialsuseridkey',
      'api_credentials_pkey'
    ];

    for (const constraint of constraintsToDrop) {
      try {
        await client.query(`
          ALTER TABLE api_credentials 
          DROP CONSTRAINT IF EXISTS ${constraint}
        `);
        console.log(`  ✓ Dropped ${constraint} (if existed)`);
      } catch (err) {
        // Ignore errors for non-existent constraints
      }
    }
    console.log('');

    // Add primary key back
    console.log('🔑 Adding primary key...');
    await client.query(`
      ALTER TABLE api_credentials 
      ADD CONSTRAINT api_credentials_pkey 
      PRIMARY KEY (id)
    `);
    console.log('  ✓ Primary key added\n');

    // Add correct unique constraint
    console.log('🔧 Adding multi-exchange constraint...');
    await client.query(`
      ALTER TABLE api_credentials 
      DROP CONSTRAINT IF EXISTS api_credentials_user_id_exchange_id_key
    `);
    
    await client.query(`
      ALTER TABLE api_credentials 
      ADD CONSTRAINT api_credentials_user_id_exchange_id_key 
      UNIQUE (user_id, exchange_id)
    `);
    console.log('  ✓ Multi-exchange constraint added\n');

    // Verify final state
    console.log('✅ Verifying final constraints...');
    const finalResult = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'api_credentials'::regclass
      ORDER BY contype, conname
    `);

    console.log('Final constraints:');
    finalResult.rows.forEach(row => {
      console.log(`  - ${row.constraint_name}: ${row.definition}`);
    });
    console.log('');

    client.release();
    await pool.end();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('You can now link multiple exchanges per user:');
    console.log('  1. Link Aster');
    console.log('  2. Link Hyperliquid');
    console.log('  3. Switch between them\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
