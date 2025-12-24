
import { Telegraf } from 'telegraf';
import 'dotenv/config';

async function main() {
    const token = process.env.BOT_TOKEN;
    if (!token) {
        console.error('No BOT_TOKEN in .env');
        return;
    }
    
    const bot = new Telegraf(token);
    const USER_ID = 703; // Target user
    
    try {
        await bot.telegram.sendMessage(USER_ID, '🚀 **System Update**\n\nThe bot has been updated with the latest changes (Referral UI, Link Logic checks). Happy Trading!', { parse_mode: 'Markdown' });
        console.log(`✅ Sent notification to ${USER_ID}`);
    } catch (e: any) {
        console.error(`❌ Failed to send: ${e.message}`);
    }
}

main();
