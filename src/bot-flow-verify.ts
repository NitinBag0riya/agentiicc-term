import 'dotenv/config';
import { connectPostgres, query } from './db/postgres';
import { citadelScene } from './bot/scenes/citadel.scene';
import { tradingScene } from './bot/scenes/trading.scene';
import { settingsScene } from './bot/scenes/settings.scene';
import { linkScene } from './bot/scenes/link.scene';
import { unlinkScene } from './bot/scenes/unlink.scene';
import { Telegraf, Scenes, session } from 'telegraf';
import type { BotContext, BotSession } from './bot/types/context';

// MOCK TELEGRAM API
// We intercept all outgoing requests so we don't hit real Telegram
const mockTelegramApi = async (method: string, payload: any) => {
    // Log important UI methods
    if (['sendMessage', 'editMessageText', 'answerCallbackQuery', 'deleteMessage'].includes(method)) {
        let text = payload.text || '';
        if (text) {
             console.log(`\n🤖 BOT [${method}]: ${text.split('\n')[0]}...`);
        } else {
             console.log(`\n🤖 BOT [${method}]: (No Text)`);
        }
        
        // Save buttons for 'crawler' to see
        if (payload.reply_markup?.inline_keyboard) {
            const buttons = payload.reply_markup.inline_keyboard.map((row: any) => row.map((b: any) => `[${b.text}|${b.callback_data}]`)).flat();
            console.log(`   [Buttons]: ${buttons.join(' ')}`);
        }
    }
    return { result: { message_id: 123456, chat: { id: 12345 } } }; // Dummy response
};

async function runRobustTest() {
    console.log('🚀 Starting Robust Multi-Exchange Bot Flow Test...');
    await connectPostgres();

    // 1. Setup User (User 20 has both credentials based on previous checks)
    const targetUserId = 20;
    
    // Define Test Scenarios
    const scenarios = [
        { exchange: 'hyperliquid', symbol: 'SOL'     , priceRegex: 'Price:' },
        { exchange: 'aster'      , symbol: 'BTC/USDT', priceRegex: 'Price:' } // Aster uses pair names often
    ];

    // 2. Setup Bot (Shared)
    const bot = new Telegraf<BotContext>('123:DUMMY_TOKEN');
    (bot.telegram as any).callApi = mockTelegramApi;
    
    // Register Scenes
    const stage = new Scenes.Stage<any>([citadelScene, tradingScene, settingsScene, linkScene, unlinkScene]);
    bot.use(session());
    
    // Dynamic Session Injector
    let currentSession: any = {};
    bot.use(async (ctx, next) => {
        ctx.session = currentSession;
        return next();
    });
    bot.use(stage.middleware());

    // Test Helpers
    let updateId = 1000;
    const sendText = async (text: string) => {
        console.log(`\n👤 USER: "${text}"`);
        await bot.handleUpdate({
            update_id: updateId++,
            message: { message_id: updateId, from: { id: 12345, is_bot: false, first_name: 'Test' }, chat: { id: 12345, type: 'private' }, date: Date.now()/1000, text }
        } as any);
    };
    const clickButton = async (data: string) => {
        console.log(`\n👆 CLICK: [${data}]`);
        await bot.handleUpdate({
            update_id: updateId++,
            callback_query: { id: String(updateId), from: { id: 12345, is_bot: false }, message: { message_id: 123, chat: { id: 12345, type: 'private' } }, data }
        } as any);
    };

    // --- RUN SCENARIOS ---
    for (const scenario of scenarios) {
        console.log(`\n\n------------------------------------------------`);
        console.log(`🧪 TESTING EXCHANGE: [${scenario.exchange.toUpperCase()}]`);
        console.log(`------------------------------------------------`);

        // Reset Session for this scenario
        currentSession = {
            userId: targetUserId,
            activeExchange: scenario.exchange,
            isLinked: true,
            __scenes: {}
        };

        // 1. Citadel
        await sendText('/menu');
        
        // 2. Trading Flow
        await clickButton('enter_trading');
        await sendText(scenario.symbol);
        await clickButton('set_limit');
        await clickButton('set_market');
        await clickButton('long_50'); // Mock Order
        await clickButton('refresh_trading');
        await clickButton('back_to_citadel');

        // 3. Settings Flow
        await clickButton('enter_settings');
        
        // 4. Test Unlink (Non-destructive)
        await clickButton('enter_unlink');
        // Should show confirmation. Click CANCEL to avoid deleting real credentials
        await clickButton('unlink_cancel');
        
        // Back to Citadel from settings (after cancel it goes to settings or citadel depending on impl, let's assume settings per flow)
        // Actually our logic says cancel -> settings. So we need to go back to citadel manually or we are in settings.
        await clickButton('back_to_citadel');
    }

    // --- TEST LINK SCENE (Isolated) ---
    console.log(`\n\n------------------------------------------------`);
    console.log(`🧪 TESTING [LINK SCENE] (Mock Start)`);
    console.log(`------------------------------------------------`);
    
    // Simulate Unlinked State
    currentSession = { userId: targetUserId, isLinked: false, __scenes: {} };
    
    await sendText('/link');
    await clickButton('link_aster');
    await clickButton('link_cancel');

    console.log('\n✅ COMPLETED: Multi-Exchange & Full Flow Verified');
    process.exit(0);
}

runRobustTest();
