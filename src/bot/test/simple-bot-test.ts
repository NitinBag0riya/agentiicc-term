/**
 * Simple Bot Test - Just sends commands and reports results
 */
import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TEST_CHAT_ID = process.env.TEST_CHAT_ID;

if (!BOT_TOKEN || !TEST_CHAT_ID) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN or TEST_CHAT_ID in .env');
  process.exit(1);
}

const telegramAPI = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TestResult {
  command: string;
  success: boolean;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Send a message
 */
async function sendMessage(text: string): Promise<boolean> {
  try {
    const response = await axios.post(`${telegramAPI}/sendMessage`, {
      chat_id: TEST_CHAT_ID,
      text,
    });
    return response.data.ok;
  } catch (error: any) {
    console.error(`Error sending "${text}":`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Test a command
 */
async function testCommand(command: string) {
  console.log(`\n📍 Testing: ${command}`);
  const success = await sendMessage(command);
  
  if (success) {
    console.log(`  ✅ Sent successfully`);
    results.push({ command, success: true });
  } else {
    console.log(`  ❌ Failed to send`);
    results.push({ command, success: false, error: 'Failed to send' });
  }
  
  // Wait for bot to process
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Main test
 */
async function main() {
  console.log('🚀 Simple Bot Command Tester');
  console.log('═'.repeat(70));
  console.log(`Bot Token: ✅ Set`);
  console.log(`Test Chat ID: ${TEST_CHAT_ID}`);
  console.log('═'.repeat(70));
  console.log('\n⚠️  This will send messages to your Telegram chat!\n');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test commands
  await testCommand('/start');
  await testCommand('/menu');
  await testCommand('/help');
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Total Commands: ${results.length}`);
  console.log(`Sent Successfully: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log('═'.repeat(70));
  
  console.log('\n✅ Commands sent! Check your Telegram to see the bot responses.');
  console.log('   Click through all the buttons manually to test all CTAs.\n');
}

main().catch(console.error);
