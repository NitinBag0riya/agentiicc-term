
import 'dotenv/config';
import { connectPostgres, getPool, disconnectPostgres } from '../src/db/postgres';

async function check() {
  try {
    await connectPostgres();
    const pool = getPool();
    const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'api_credentials' AND column_name = 'exchange_id';
    `);
    
    if (res.rows.length > 0) {
        console.log('✅ Column exchange_id EXISTS');
    } else {
        console.log('❌ Column exchange_id MISSING');
    }
  } catch (e: any) {
      console.error(e);
  } finally {
      await disconnectPostgres();
  }
}
check();
