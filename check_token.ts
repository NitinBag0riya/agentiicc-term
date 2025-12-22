
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

dotenv.config();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not found');
    return;
  }
  
  const bot = new Telegraf(token);
  try {
    const me = await bot.telegram.getMe();
    console.log('Bot Info:', me);
  } catch (err) {
    console.error('❌ Error getting bot info:', err.message);
  }
}

main();
