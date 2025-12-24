/**
 * Create seed/admin user with referral code
 * Run with: bun run create_seed_user.ts
 */

import { connectPostgres, getPostgres } from './src/db/postgres';
import { createSeedUser } from './src/db/referrals';

// User's actual Telegram ID
const ADMIN_TELEGRAM_ID = 7797429783; // @scornitzz
const ADMIN_USERNAME = 'scornitzz';

async function main() {
  console.log('🌱 Creating Seed User...\n');

  await connectPostgres();
  const db = getPostgres();

  const result = await createSeedUser(db, ADMIN_TELEGRAM_ID, ADMIN_USERNAME);

  console.log('✅ Seed User Created!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   User ID:       ${result.userId}`);
  console.log(`   Telegram ID:   ${ADMIN_TELEGRAM_ID}`);
  console.log(`   Referral Code: ${result.referralCode}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📲 Share this link to invite users:`);
  console.log(`   https://t.me/YOUR_BOT_USERNAME?start=${result.referralCode}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
