
import dotenv from 'dotenv';
import { connectPostgres, getPool, disconnectPostgres, query } from './src/db/postgres';
import { initEncryption, encrypt } from './src/utils/encryption';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production';
    initEncryption(encryptionKey);

    const TELEGRAM_ID = 7797429783;
    
    console.log(`Deleting all existing API credentials to force relink...`);
    await query('DELETE FROM api_credentials');
    
    console.log('✅ Credentials deleted. Please use /link in the bot to reconnect.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectPostgres();
  }
}

main();
