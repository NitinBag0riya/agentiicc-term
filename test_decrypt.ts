import { connectPostgres, query } from './src/db/postgres';
import * as crypto from 'crypto';

// CBC decryption (matching agentiicc-term format)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_must_be_32_bytes_long!!';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
}

function decryptCBC(text: string): string {
  const key = getKey();
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function main() {
  await connectPostgres(process.env.DATABASE_URL);
  
  const result = await query<any>('SELECT id, user_id, exchange_id, api_key_encrypted FROM api_credentials LIMIT 1');
  
  for (const row of result) {
    const encVal = row.api_key_encrypted;
    console.log(`\n--- User ${row.user_id}, Exchange: ${row.exchange_id} ---`);
    console.log('Encrypted:', encVal.substring(0, 50) + '...');
    console.log('ENCRYPTION_KEY used:', ENCRYPTION_KEY.substring(0, 20) + '...');
    
    try {
      const decrypted = decryptCBC(encVal);
      console.log('✅ Decryption SUCCESSFUL!');
      console.log('Decrypted (first 10 chars):', decrypted.substring(0, 10) + '...');
    } catch (e: any) {
      console.log('❌ Decryption FAILED:', e.message);
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
