#!/usr/bin/env bun
/**
 * Script to clear all linked exchanges for a fresh start
 */

import { getPool, connectPostgres, disconnectPostgres } from '../src/db/postgres';
import dotenv from 'dotenv';

dotenv.config();

async function clearAllCredentials() {
  console.log('🔄 Connecting to database...');
  await connectPostgres();
  
  const pool = getPool();
  
  try {
    // Get count of existing credentials
    const countResult = await pool.query('SELECT COUNT(*) FROM api_credentials');
    const count = parseInt(countResult.rows[0].count);
    console.log(`📊 Found ${count} linked exchange credentials`);
    
    if (count > 0) {
      // Delete all credentials
      await pool.query('DELETE FROM api_credentials');
      console.log(`✅ Deleted ${count} exchange credentials`);
    } else {
      console.log('ℹ️  No credentials to delete');
    }
    
    // Also clear Redis sessions if needed
    console.log('✅ Fresh start ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart the bot');
    console.log('2. Send /start to the bot');
    console.log('3. You should see the Welcome Screen with exchange selection');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectPostgres();
  }
}

clearAllCredentials();
