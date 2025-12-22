
import dotenv from 'dotenv';
import { connectPostgres, getPool, disconnectPostgres } from './src/db/postgres';
import { createSeedUser } from './src/db/referrals';

dotenv.config();

async function main() {
  try {
    await connectPostgres();
    const pool = getPool();

    const USER_ID = 7797429783; 
    const USERNAME = 'scornitzz';

    console.log(`Verifying user and generating referral for ID: ${USER_ID}...`);
    
    const result = await createSeedUser(pool, USER_ID, USERNAME);
    
    console.log('\n✅ User Verified & Referral Generated!');
    console.log('------------------------------------------------');
    console.log(`User ID:        ${result.userId}`);
    console.log(`Telegram ID:    ${USER_ID}`);
    console.log(`Username:       ${USERNAME}`);
    console.log(`Referral Code:  ${result.referralCode}`);
    console.log('------------------------------------------------');
    console.log(`Bot Link:       https://t.me/My_Test_Tradeee_bot?start=${result.referralCode}`);
    console.log('------------------------------------------------\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectPostgres();
  }
}

main();
