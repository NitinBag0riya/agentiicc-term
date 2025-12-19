import 'dotenv/config';
import { connectPostgres, query } from './db/postgres';
// REMOVED: Direct AdapterFactory usage. We test strictly via the Bot UI (Universal Interface).
import { citadelScene } from './bot/scenes/citadel.scene';
import { tradingScene } from './bot/scenes/trading.scene';
import { Scenes, session, Telegraf } from 'telegraf';
import type { BotContext } from './bot/types/context';
import Decimal from 'decimal.js';

// --- QA REPORTING ---
const report: string[] = [];
function pass(msg: string) { 
    console.log(`✅ ${msg}`); 
    report.push(`✅ ${msg}`);
}
function fail(msg: string, details?: any) { 
    console.error(`❌ ${msg}`); 
    if (details) console.error('   Details:', JSON.stringify(details, null, 2));
    report.push(`❌ ${msg}`);
}
function info(msg: string) {
    console.log(`ℹ️ ${msg}`);
    report.push(`ℹ️ ${msg}`);
}

// --- INTERCEPTOR ---
const mockTelegramApi = async (method: string, payload: any) => {
    if (['sendMessage', 'editMessageText'].includes(method)) {
        const text = payload.text || '';
        if (text) {
             // console.log('DEBUG CAPTURE:', text.substring(0, 30));
             validateUiRepresentation(text);
             // Also try to validate Logic based on what we SEE
             validateLogicFromText(text);
        }
    }
    return { result: { message_id: 123456, chat: { id: 12345 } } };
};

// --- VALIDATORS ---

function validateUiRepresentation(text: string) {
    // 1. Check for bad values
    if (text.includes('NaN')) fail('UI contains "NaN"', text.substring(0, 50));
    if (text.includes('undefined')) fail('UI contains "undefined"', text.substring(0, 50));
    if (text.includes('null')) fail('UI contains "null"', text.substring(0, 50));

    // 2. Check Formatting
    if (text.includes('**')) pass('UI employs Bold formatting');
}

function validateLogicFromText(text: string) {
    // Attempt to extract numbers to verify logic if possible
    // Example Citadel: "Total Balance: $12.50"
    const totalMatch = text.match(/Total Balance:\s*\*\*?\$([\d,.]+)\*\*?/);
    const availMatch = text.match(/Available:\s*\*\*?\$([\d,.]+)\*\*?/);
    
    if (totalMatch && availMatch) {
         const total = new Decimal(totalMatch[1].replace(/,/g, ''));
         const avail = new Decimal(availMatch[1].replace(/,/g, ''));
         if (avail.gt(total)) {
             fail(`Logic Fail: Available ($${avail}) > Total ($${total})`);
         } else {
             pass(`Logic Verified (UI): Total $${total} >= Available $${avail}`);
         }
    }
    
    // Example Trading: Price extraction
    const priceMatch = text.match(/Price:\s*\$([\d,.]+)/);
    if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (price > 0) pass(`Data Verified (UI): Price $${price} is valid`);
        else fail(`Data Fail (UI): Price ${price} is invalid`);
    }
}

// --- RUNNER ---

async function runQaVerify() {
    console.log('🚀 Starting Final End-to-End QA Validation (User Perspective)...');
    await connectPostgres();

    // 1. Setup User
    const targetUserId = 20; 
    const scenarios = [
        { exchange: 'hyperliquid', symbol: 'SOL' },
        { exchange: 'aster', symbol: 'BTC_USDT' }
    ];

    // 2. Setup Bot Harness
    const bot = new Telegraf<BotContext>('123:DUMMY');
    (bot.telegram as any).callApi = mockTelegramApi;
    const stage = new Scenes.Stage<any>([citadelScene, tradingScene]);
    bot.use(session());
    
    // Session Injection
    let currentSession: any = {};
    bot.use(async (ctx, next) => { ctx.session = currentSession; return next(); });
    bot.use(stage.middleware());

    // Runner Helpers
    let updateId = 5000;
    const send = async (txt: string) => {
        await bot.handleUpdate({ update_id: updateId++, message: { message_id: updateId, from: {id:1, is_bot:false}, chat:{id:1, type:'private'}, date:Date.now()/1000, text: txt } } as any);
    };
    const click = async (data: string) => {
        await bot.handleUpdate({ update_id: updateId++, callback_query: { id:String(updateId), from:{id:1, is_bot:false}, message:{message_id:123, chat:{id:1, type:'private'}}, data } } as any);
    };

    // --- EXECUTION ---
    for (const s of scenarios) {
        console.log(`\n🔎 [QA] Testing Exchange: ${s.exchange}`);
        currentSession = { userId: targetUserId, activeExchange: s.exchange, isLinked: true, __scenes: {} };

        // A. UI Flow & Representation Validation (Output Verified by Interceptor)
        await send('/menu'); // Citadel checks
        
        await click('enter_trading');
        await send(s.symbol); // Ticker UI checks
        
        await click('set_limit');
        await click('long_50'); 
    }

    console.log('\n📝QA REPORT SUMMARY:');
    console.log(report.join('\n'));
    process.exit(0);
}

runQaVerify();
