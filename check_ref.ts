
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const res = await db.query("SELECT referral_code FROM users WHERE telegram_id = '703'");
    console.log('Code:', res.rows[0]?.referral_code);
    await db.end();
}
main();
