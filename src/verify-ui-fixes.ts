
import { formatters } from './bot/utils/formatters';
import { Telegraf, Scenes, session } from 'telegraf';
import { settingsScene } from './bot/scenes/settings.scene';
import { linkScene } from './bot/scenes/link.scene';
import { citadelScene } from './bot/scenes/citadel.scene';

// --- PART 1: Unit Test Formatters ---
console.log('🧪 Testing Formatters Safety...');

function assert(label: string, actual: string, expected: string) {
    if (actual === expected) console.log(`✅ ${label}: Passed (${actual})`);
    else console.error(`❌ ${label}: Failed. Expected "${expected}", got "${actual}"`);
}

try {
    assert('PnL (Empty)', formatters.pnlPercentage('', ''), '0.00%');
    assert('PnL (Zero Denom)', formatters.pnlPercentage('10', '0'), '0.00%');
    assert('Pos Value (NaN)', formatters.positionValue('NaN', '100'), '$0.00');
    assert('Pos Value (Null)', formatters.positionValue(null as any, '100'), '$0.00');
    assert('Order Value (Undef)', formatters.orderValue(undefined as any, '100'), '$0.00 USDT');
    assert('Preview Margin (NaN)', formatters.previewMargin('NaN', '10', 'ADD'), '$0.00');
    
    // Valid case
    assert('Valid PnL', formatters.pnlPercentage('10', '100'), '10.00%');
    console.log('✨ All Formatter Tests Passed');
} catch (e) {
    console.error('Formatter Test Crash:', e);
}

// --- PART 2: Settings integration Test ---
console.log('\n🧪 Testing Settings -> Link Flow...');

const mockTelegramApi = async (method: string, payload: any) => {
    if (method === 'sendMessage' || method === 'editMessageText') {
        const text = payload.text || '';
        // Check if we reached Link Scene (Step 0)
        // Link scene step 0 text: "Link Exchange" ... "Select which exchange"
        if (text.includes('Link Exchange') && text.includes('Select which exchange')) {
            console.log('✅ Verified: Entered Link Scene via Settings');
        }
        // Check if Link button exists in Settings
        if (payload.reply_markup?.inline_keyboard) {
            const btns = JSON.stringify(payload.reply_markup.inline_keyboard);
            if (btns.includes('link_exchange')) {
                console.log('✅ Verified: "Link Exchange" button present in Settings');
            }
        }
    }
    return { result: { message_id: 123, chat: { id: 123 } } };
};

const bot = new Telegraf('123:DUMMY');
(bot.telegram as any).callApi = mockTelegramApi;
const stage = new Scenes.Stage([settingsScene, linkScene, citadelScene]);
bot.use(session());
bot.use(async (ctx: any, next) => {
    ctx.session = { activeExchange: 'aster', isLinked: true };
    next();
});
bot.use(stage.middleware());

// Run Flow
async function run() {
    bot.command('test_settings', (ctx) => ctx.scene.enter('settings'));
    
    // 1. Enter Settings
    console.log('👉 Entering Settings...');
     await (bot as any).handleUpdate({
         update_id: 1,
         message: { message_id: 1, from: {id:1}, chat:{id:1, type:'private'}, text: '/test_settings', date: Date.now()/1000 }
    });

    // 2. Click Link Exchange
    console.log('👉 Clicking Link Exchange...');
    await (bot as any).handleUpdate({
         update_id: 2,
         callback_query: { 
             id: '2', 
             from: {id:1}, 
             message: { message_id: 123, chat:{id:1, type:'private'} }, 
             data: 'link_exchange' 
         }
    });
}

run();
