import 'dotenv/config';
import { URL } from 'url';

async function verifyDbHost() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  try {
    const parsedUrl = new URL(dbUrl);
    const host = parsedUrl.hostname;
    
    console.log('\n🔍 Database Connection Verification:');
    console.log('-----------------------------------');
    console.log(`Host:     ${host}`);
    
    if (host.includes('supabase.com') || host.includes('aws') || host.includes('railway')) {
         console.log('✅ Connection Type: REMOTE (Cloud/Supabase)');
    } else if (host === 'localhost' || host === '127.0.0.1') {
         console.log('❌ Connection Type: LOCAL (Localhost)');
         console.error('CRITICAL: You are connected to a local database. Please update .env to use Supabase.');
    } else {
         console.log('⚠️  Connection Type: UNKNOWN (Custom Host)');
    }
    console.log('-----------------------------------\n');

  } catch (error) {
    console.error('❌ Failed to parse DATABASE_URL:', error);
  }
}

verifyDbHost();
