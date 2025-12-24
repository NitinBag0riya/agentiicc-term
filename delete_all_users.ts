/**
 * DANGEROUS SCRIPT: Delete all users and credentials
 * Run with: bun run delete_all_users.ts
 */

import { connectPostgres, query } from './src/db/postgres';
import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;

interface UserRow {
  id: number;
  telegram_id: number;
  username?: string;
}

async function deleteAllUsersAndNotify() {
  console.log('⚠️  DANGEROUS OPERATION: Delete ALL Users and Credentials\n');
  console.log('=' .repeat(50));

  // Connect to DB
  await connectPostgres();
  console.log('✅ Connected to database\n');

  // Get all users with their telegram IDs
  console.log('[1] Fetching all users...');
  const users = await query<UserRow>('SELECT id, telegram_id, username FROM users');
  console.log(`   Found ${users.length} users`);

  if (users.length === 0) {
    console.log('   No users to delete. Exiting.');
    process.exit(0);
  }

  // Initialize Telegram bot for notifications
  const bot = new Telegraf(BOT_TOKEN!);
  
  const notificationMessage = `
🔔 **Account Reset Notice**

Your account has been reset by the administrator.

**What this means:**
• Your API credentials have been removed
• You need to re-link your exchange account

To continue using the bot:
1️⃣ Use /menu
2️⃣ Click "Link Account"
3️⃣ Connect your exchange again

If you have questions, please contact support.
`;

  // Notify each user
  console.log('\n[2] Notifying users via Telegram...');
  let notified = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, notificationMessage, {
        parse_mode: 'Markdown'
      });
      console.log(`   ✅ Notified: ${user.telegram_id} (${user.username || 'no username'})`);
      notified++;
    } catch (err: any) {
      console.log(`   ❌ Failed to notify ${user.telegram_id}: ${err.message}`);
      failed++;
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n   Notifications: ${notified} sent, ${failed} failed`);

  // Delete credentials first (foreign key)
  console.log('\n[3] Deleting API credentials...');
  const credResult = await query('DELETE FROM api_credentials RETURNING id');
  console.log(`   ✅ Deleted ${credResult.length} credential records`);

  // Delete orders
  console.log('\n[4] Deleting orders...');
  const orderResult = await query('DELETE FROM orders RETURNING id');
  console.log(`   ✅ Deleted ${orderResult.length} order records`);

  // Delete referrals
  console.log('\n[5] Deleting referrals...');
  const refResult = await query('DELETE FROM referrals RETURNING id');
  console.log(`   ✅ Deleted ${refResult.length} referral records`);

  // Delete users
  console.log('\n[6] Deleting users...');
  const userResult = await query('DELETE FROM users RETURNING id');
  console.log(`   ✅ Deleted ${userResult.length} user records`);

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 ALL DATA DELETED SUCCESSFULLY');
  console.log('=' .repeat(50));

  process.exit(0);
}

deleteAllUsersAndNotify().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
