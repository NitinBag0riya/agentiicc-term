import { connectPostgres, query } from './src/db/postgres';

async function main() {
  await connectPostgres(process.env.DATABASE_URL);
  
  const result = await query<any>('SELECT id, user_id, exchange_id, api_key_encrypted FROM api_credentials LIMIT 3');
  
  for (const row of result) {
    const encVal = row.api_key_encrypted;
    console.log(`\n--- User ${row.user_id}, Exchange: ${row.exchange_id} ---`);
    console.log('Encrypted value length:', encVal.length);
    console.log('First 60 chars:', encVal.substring(0, 60));
    console.log('Has colon (CBC format):', encVal.includes(':'));
    console.log('Is pure hex (GCM format):', /^[0-9a-f]+$/i.test(encVal));
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
