import 'dotenv/config';
import { BotTester } from './BotTester';
import { getExpectedMethod } from './cta-map';
import { createBot } from '../bot';

/**
 * Recursive Bot-CTA Verification Script
 */
async function main() {
  console.log('🏁 Starting Recursive Bot-CTA Verification...\n');

  const token = process.env.TELEGRAM_BOT_TOKEN || 'mock-token';
  const bot = createBot(token);
  const tester = new BotTester();
  const visited = new Set<string>();
  const queue: string[] = ['menu']; // Start with menu callback
  
  const report: Array<{ action: string; apiMethod: string | null; status: 'SUCCESS' | 'FAILED' | 'SKIPPED' }> = [];

  // 1. Initial /start simulation
  console.log('🚀 Triggering /start...');
  const ctx = tester.createContext();
  // We manually call the handler if we can find it, or use handleUpdate
  // Since we want to test RECURSIVELY through buttons, we focus on actions.

  while (queue.length > 0) {
    const action = queue.shift()!;
    if (visited.has(action)) continue;
    visited.add(action);

    console.log(`➡️ Testing Action: ${action}`);

    // Find expected API method
    const expectedApiMethod = getExpectedMethod(action);
    tester.clearCalls();

    // Trigger update
    const update = {
      callback_query: {
        data: action,
        from: { id: 123 },
        message: { message_id: 123, chat: { id: 123, type: 'private' } }
      }
    };

    try {
      await bot.handleUpdate(update as any);
      
      // Verify API call
      const actualCall = tester.apiCalls.find(c => c.method === expectedApiMethod);
      
      if (expectedApiMethod && actualCall) {
        console.log(`✅ Verified API Call: UniversalApiService.${expectedApiMethod}`);
        report.push({ action, apiMethod: expectedApiMethod, status: 'SUCCESS' });
      } else if (expectedApiMethod) {
        console.warn(`❌ Missing API Call: Expected UniversalApiService.${expectedApiMethod}`);
        report.push({ action, apiMethod: expectedApiMethod, status: 'FAILED' });
      } else {
        console.log(`ℹ️ No API call expected for action: ${action}`);
        report.push({ action, apiMethod: null, status: 'SKIPPED' });
      }

      // Add new buttons to queue
      for (const row of tester.lastButtons) {
        for (const btn of row) {
          if (btn.callback_data && !visited.has(btn.callback_data)) {
            queue.push(btn.callback_data);
          }
        }
      }

    } catch (error: any) {
      console.error(`💥 Error during action ${action}:`, error.message);
    }
  }

  // Final Report
  console.log('\n=========================================');
  console.log('📊 VERIFICATION REPORT');
  console.log('=========================================');
  console.table(report);
  
  const successCount = report.filter(r => r.status === 'SUCCESS').length;
  const totalApiActions = report.filter(r => r.apiMethod !== null).length;
  
  console.log(`\n✅ Summary: ${successCount}/${totalApiActions} API actions verified via segments.`);
  console.log(`🏁 Total unique CTAs explored: ${visited.size}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
