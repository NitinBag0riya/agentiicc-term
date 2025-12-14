#!/usr/bin/env bun
/**
 * Link Exchange Credentials
 * Stores API credentials in the database for testing
 */

import { Pool } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_must_be_32_bytes_long!!';

// Use SHA256 hash to ensure 32-byte key (same as app)
const key = createHash('sha256').update(String(ENCRYPTION_KEY)).digest();

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function linkCredentials() {
  console.log("🔗 Linking Exchange Credentials");
  console.log("=" .repeat(60));
  
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    // Create or get user
    console.log("\n1. Creating/Getting user...");
    const userResult = await pool.query(
      `INSERT INTO users (telegram_id, username, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (telegram_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [123456789, 'test_user']
    );
    const userId = userResult.rows[0].id;
    console.log(`✅ User ID: ${userId}`);
    
    // Link Aster credentials
    console.log("\n2. Linking Aster credentials...");
    const asterApiKey = process.env.ASTER_API_KEY;
    const asterApiSecret = process.env.ASTER_API_SECRET;
    
    if (asterApiKey && asterApiSecret) {
      const encryptedKey = encrypt(asterApiKey);
      const encryptedSecret = encrypt(asterApiSecret);
      
      await pool.query(
        `INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted, testnet, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (user_id, exchange_id) DO UPDATE 
         SET api_key_encrypted = $3, api_secret_encrypted = $4, updated_at = NOW()`,
        [userId, 'aster', encryptedKey, encryptedSecret, false]
      );
      console.log("✅ Aster credentials linked");
    } else {
      console.log("⚠️  Aster credentials not found in .env");
    }
    
    // Link Hyperliquid credentials
    console.log("\n3. Linking Hyperliquid credentials...");
    const hlPrivateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
    const hlAddress = process.env.HYPERLIQUID_ADDRESS;
    
    if (hlPrivateKey) {
      const encryptedKey = encrypt(hlPrivateKey);
      const encryptedSecret = encrypt(hlAddress || ''); // Use address as secret
      const additionalData = hlAddress ? encrypt(JSON.stringify({ address: hlAddress })) : null;
      
      await pool.query(
        `INSERT INTO api_credentials (user_id, exchange_id, api_key_encrypted, api_secret_encrypted, additional_data_encrypted, testnet, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (user_id, exchange_id) DO UPDATE 
         SET api_key_encrypted = $3, api_secret_encrypted = $4, additional_data_encrypted = $5, updated_at = NOW()`,
        [userId, 'hyperliquid', encryptedKey, encryptedSecret, additionalData, false]
      );
      console.log("✅ Hyperliquid credentials linked");
    } else {
      console.log("⚠️  Hyperliquid credentials not found in .env");
    }
    
    // Verify credentials
    console.log("\n4. Verifying credentials...");
    const credsResult = await pool.query(
      `SELECT exchange_id FROM api_credentials WHERE user_id = $1`,
      [userId]
    );
    
    console.log(`✅ Found ${credsResult.rows.length} linked exchanges:`);
    credsResult.rows.forEach(row => {
      console.log(`   - ${row.exchange_id}`);
    });
    
    console.log("\n" + "=" .repeat(60));
    console.log("✅ Credentials linked successfully!");
    console.log("\nYou can now run order tests with:");
    console.log("  bun run test-orders.ts");
    console.log("");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

linkCredentials().catch(console.error);
