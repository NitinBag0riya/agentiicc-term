
import { Client } from 'pg';
import 'dotenv/config';

async function main() {
    console.log('🧹 STARTING DB CLEANUP\n');
    
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const TEST_IDS = ['88888', '123456789'];
    // Not deleting 703 (Primary Test User)
    
    for (const tid of TEST_IDS) {
        console.log(`Checking ID: ${tid}...`);
        
        // Get Internal ID
        const res = await db.query('SELECT id FROM users WHERE telegram_id = $1', [tid]);
        
        if (res.rows.length > 0) {
            const uid = res.rows[0].id;
            console.log(`Found User ${tid} (Internal: ${uid}). Cleaning...`);
            
            // Delete Referrals (Referring others)
            await db.query('DELETE FROM referrals WHERE referrer_user_id = $1', [uid]);
            // Delete Referrals (Referred by others)
            await db.query('DELETE FROM referrals WHERE referred_user_id = $1', [uid]);
            
            // Delete Credentials
            await db.query('DELETE FROM api_credentials WHERE user_id = $1', [uid]);
            
            // Delete User
            await db.query('DELETE FROM users WHERE id = $1', [uid]);
            console.log(`✅ Deleted User ${tid}`);
        } else {
            console.log(`User ${tid} not found.`);
        }
    }
    
    // Optional: Reset logic for 703? 
    // Maybe unlink credentials for 703 so they start fresh?
    // User asked "cleanr up db".
    // I won't unlink 703 blindly. They can do it via /settings.
    
    console.log('\n✨ Cleanup Complete.');
    await db.end();
}

main().catch(console.error);
