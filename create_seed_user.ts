
import dotenv from 'dotenv';
import { connectPostgres, getPool, disconnectPostgres } from './src/db/postgres';
import { createSeedUser } from './src/db/referrals';

dotenv.config();

async function main() {
  try {
    // Connect to DB
    await connectPostgres();
    const pool = getPool();

    // specific seed user ID (can be anything, but using a distinctive one)
    const SEED_USER_ID = 7777777; 
    const SEED_USERNAME = 'admin_seed_user';

    console.log(`Creating seed user (ID: ${SEED_USER_ID})...`);
    
    // Create seed user
    const result = await createSeedUser(pool, SEED_USER_ID, SEED_USERNAME);
    
    console.log('\n✅ Seed User Created Successfully!');
    console.log('------------------------------------------------');
    console.log(`User ID:        ${result.userId}`);
    console.log(`Telegram ID:    ${SEED_USER_ID}`);
    console.log(`Username:       ${SEED_USERNAME}`);
    console.log(`Referral Code:  ${result.referralCode}`);
    console.log('------------------------------------------------');
    console.log(`Ref Link:       https://t.me/My_Test_Tradeee_bot?start=${result.referralCode}`);
    console.log('------------------------------------------------\n');
    console.log('You can now use this referral code to invite other users.');

  } catch (error) {
    console.error('❌ Error creating seed user:', error);
  } finally {
    await disconnectPostgres();
  }
}

main();
