import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { AdapterFactory } from '../../adapters/factory';
import { formatters } from '../utils/formatters';
import Decimal from 'decimal.js';

interface TradingState {
  symbol?: string;
  // Order Settings
  orderType: 'MARKET' | 'LIMIT';
  leverage: number;
  
  // Data Cache
  ticker?: any;
  position?: any;
  
  // Pending Order (for Confirmation)
  pendingAction?: {
      type: 'OPEN' | 'ADD' | 'CLOSE';
      side: 'LONG' | 'SHORT';
      amountUsd?: number; // Input USD
      quantity?: number;  // Calculated Coin Qty
      percent?: number;   // For closes
      isReduceOnly?: boolean;
  };
}

export const tradingScene = new Scenes.WizardScene<BotContext>(
  'trading',

  // Step 0: Symbol Search / Initialization
  async (ctx) => {
    const state = ctx.wizard.state as TradingState;
    if (!state.orderType) state.orderType = 'MARKET';
    if (!state.leverage) state.leverage = 1;

    // If symbol provided (e.g. from Citadel), skip search
    if (state.symbol) {
        return stepHandler(ctx);
    }

    await ctx.reply(
        '🔍 **Search Asset**\n\n' +
        'Reply with the symbol (e.g., SOL, ETH, BTC):',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_trading')]
            ])
        }
    );
    return ctx.wizard.next();
  },

  // Step 1: Main Dashboard Handler (Re-entrant)
  async (ctx) => {
      return stepHandler(ctx);
  }
);

// --- GLOBAL NAVIGATION ---
tradingScene.command('start', (ctx) => ctx.scene.enter('citadel'));
tradingScene.command('menu', (ctx) => ctx.scene.enter('citadel'));

// --- MAIN HANDLER ---
const stepHandler = async (ctx: BotContext) => {
    const state = ctx.wizard.state as TradingState;

    // 1. Input Processing (if text)
    if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text.toUpperCase().trim();
        // Navigation Override
        if (text === '/START' || text === '/MENU') {
             return ctx.scene.enter('citadel');
        }
        state.symbol = text;
    }

    if (!state.symbol) {
        await ctx.reply('⚠️ Please provide a valid symbol.');
        return; 
    }

    // 2. Fetch Data
    const userId = ctx.session.userId;
    const exchangeId = ctx.session.activeExchange;
    
    try {
        if (!userId || !exchangeId) throw new Error('Not linked');

        // Show loading only if not callback replacement
        let loadingMsg;
        if (!ctx.callbackQuery) {
            loadingMsg = await ctx.reply(`🔄 Loading ${state.symbol}...`);
        }

        const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
        const [ticker, positions] = await Promise.all([
            adapter.getTicker(state.symbol),
            adapter.getPositions()
        ]);

        // Fuzzy match position
        const position = positions.find(p => p.symbol === state.symbol || p.symbol.startsWith(state.symbol!));
        
        state.ticker = ticker;
        state.position = position;

        if (loadingMsg) await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
        
        // Render Dashboard
        await renderTradingDashboard(ctx, state);
        
        // Ensure we stay at Step 1 (Index 1) for re-entry
        ctx.wizard.selectStep(1);

    } catch (error: any) {
        await ctx.reply(`❌ Error: ${error.message}`);
        return ctx.scene.enter('citadel');
    }
};

// --- RENDERER ---
async function renderTradingDashboard(ctx: BotContext, state: TradingState) {
     const { ticker, position } = state;
     if (!ticker) return;

     const price = parseFloat(ticker.lastPrice || ticker.price);
     
     let msg = `📊 **${state.symbol}**\n`;
     msg += `Price: **$${price.toFixed(price < 1 ? 4 : 2)}**\n`;
     
     // 1. CONFIRMATION SCREEN (Intermediate State)
     if (state.pendingAction) {
         const action = state.pendingAction;
         msg += `\n⚠️ **CONFIRM ORDER**\n`;
         
         if (action.type === 'CLOSE') {
             msg += `Action: **Close ${action.percent}%**\n`;
             msg += `Est. Value: $${(action.amountUsd || 0).toFixed(2)}\n`;
         } else {
             msg += `Action: **${action.side} ${state.symbol}**\n`;
             msg += `Amount: **$${action.amountUsd}**\n`;
             msg += `Leverage: ${state.leverage}x\n`;
         }
         
         msg += `\nProceed?`;
         
         await ctx.editMessageText(msg, {
             parse_mode: 'Markdown',
             ...Markup.inlineKeyboard([
                 [
                     Markup.button.callback('✅ Confirm', 'confirm_execution'),
                     Markup.button.callback('❌ Cancel', 'cancel_action')
                 ]
             ])
         });
         return;
     }

     // 2. NORMAL DASHBOARD
     const buttons: any[] = [];

     if (position) {
         // --- POSITION VIEW ---
         const pnl = parseFloat(position.unrealizedPnl);
         const pnlColor = pnl >= 0 ? '🟢' : '🔴';
         const sizeUsd = Math.abs(parseFloat(position.size) * price);
         
         msg += `\n**Open Position**\n`;
         msg += `Side: **${position.side}**\n`;
         msg += `Size: $${sizeUsd.toFixed(2)} (${position.size})\n`;
         msg += `Entry: $${parseFloat(position.entryPrice).toFixed(2)}\n`;
         msg += `PnL: ${pnlColor} $${pnl.toFixed(2)} (${formatters.pnlPercentage(position.unrealizedPnl, position.margin)})\n`;

         // APE Buttons (Add to Position)
         buttons.push([
             Markup.button.callback('➕ Ape $50', 'ape_50'),
             Markup.button.callback('➕ Ape $200', 'ape_200')
         ]);
         
         // CLOSE Buttons
         buttons.push([
            Markup.button.callback('🚪 Close All', 'close_100'),
            Markup.button.callback('📉 Sell 50%', 'close_50'),
            Markup.button.callback('📉 Sell 25%', 'close_25')
         ]);

     } else {
         // --- TRADING VIEW (No Position) ---
         msg += `\n**New Order**\n`;
         msg += `Mode: ${state.orderType} | Lev: ${state.leverage}x\n`;
         
         buttons.push([ // Mode/Lev Toggles
             Markup.button.callback(`${state.orderType === 'MARKET' ? '✅' : ''} Market`, 'set_market'),
             Markup.button.callback(`${state.orderType === 'LIMIT' ? '✅' : ''} Limit`, 'set_limit'),
             Markup.button.callback('⚙️ Lev', 'cycle_leverage')
         ]);
         
         // LONG Buttons
         buttons.push([
            Markup.button.callback('🐂 Long $50', 'long_50'),
            Markup.button.callback('🐂 Long $200', 'long_200')
         ]);
         
         // SHORT Buttons
         buttons.push([
            Markup.button.callback('🐻 Short $50', 'short_50'),
            Markup.button.callback('🐻 Short $200', 'short_200')
         ]);
     }

     // COMMON Nav
     buttons.push([
         Markup.button.callback('🔄 Refresh', 'refresh_trading'),
         Markup.button.callback('« Back', 'back_to_citadel')
     ]);

     // Send/Edit
     const extra = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) };
     if (ctx.callbackQuery) {
         // Try edit, fallback to reply (e.g. if message content same)
         try { await ctx.editMessageText(msg, extra); }
         catch { await ctx.reply(msg, extra); }
     } else {
         await ctx.reply(msg, extra);
     }
}

// --- ACTIONS ---

// Navigation
tradingScene.action('back_to_citadel', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('citadel');
});
tradingScene.action('cancel_trading', async (ctx) => ctx.scene.enter('citadel'));
tradingScene.action('refresh_trading', async (ctx) => {
    await ctx.answerCbQuery('Refreshing...');
    return stepHandler(ctx);
});

// Settings
tradingScene.action('set_market', async (ctx) => {
    (ctx.wizard.state as TradingState).orderType = 'MARKET';
    await ctx.answerCbQuery('Market Mode');
    return renderTradingDashboard(ctx, ctx.wizard.state as TradingState);
});
tradingScene.action('set_limit', async (ctx) => {
    (ctx.wizard.state as TradingState).orderType = 'LIMIT';
    await ctx.answerCbQuery('Limit Mode');
    return renderTradingDashboard(ctx, ctx.wizard.state as TradingState);
});
tradingScene.action('cycle_leverage', async (ctx) => {
    const s = ctx.wizard.state as TradingState;
    s.leverage = s.leverage >= 50 ? 1 : (s.leverage >= 20 ? 50 : (s.leverage >= 10 ? 20 : (s.leverage >= 5 ? 10 : 5)));
    await ctx.answerCbQuery(`Leverage: ${s.leverage}x`);
    return renderTradingDashboard(ctx, s);
});

// --- ORDER PREP ---

// Generic Prep Helper (LONG/SHORT New)
const prepOrder = async (ctx: BotContext, side: 'LONG'|'SHORT', amountUsd: number) => {
    const state = ctx.wizard.state as TradingState;
    if (!state.ticker) return;

    state.pendingAction = {
        type: 'OPEN',
        side,
        amountUsd
    };
    await ctx.answerCbQuery();
    return renderTradingDashboard(ctx, state);
};

// Generic Prep Ape (Add)
const prepApe = async (ctx: BotContext, amountUsd: number) => {
    const state = ctx.wizard.state as TradingState;
    if (!state.position || !state.ticker) return;
    
    state.pendingAction = {
        type: 'ADD',
        side: state.position.side, // Same side
        amountUsd
    };
    await ctx.answerCbQuery();
    return renderTradingDashboard(ctx, state);
};

// Generic Prep Close
const prepClose = async (ctx: BotContext, percent: number) => {
    const state = ctx.wizard.state as TradingState;
    if (!state.position || !state.ticker) return;
    
    // Calculate estimated value
    const price = parseFloat(state.ticker.lastPrice || state.ticker.price || '0');
    const size = Math.abs(parseFloat(state.position.size));
    const value = (size * price) * (percent / 100);

    state.pendingAction = {
        type: 'CLOSE',
        side: state.position.side === 'LONG' ? 'SHORT' : 'LONG', // Opposite
        isReduceOnly: true,
        percent,
        amountUsd: value
    };
    await ctx.answerCbQuery();
    return renderTradingDashboard(ctx, state);
};

// New Order Actions
tradingScene.action('long_50', (ctx) => prepOrder(ctx, 'LONG', 50));
tradingScene.action('long_200', (ctx) => prepOrder(ctx, 'LONG', 200));
tradingScene.action('short_50', (ctx) => prepOrder(ctx, 'SHORT', 50));
tradingScene.action('short_200', (ctx) => prepOrder(ctx, 'SHORT', 200));

// Ape Actions
tradingScene.action('ape_50', (ctx) => prepApe(ctx, 50));
tradingScene.action('ape_200', (ctx) => prepApe(ctx, 200));

// Close Actions
tradingScene.action('close_100', (ctx) => prepClose(ctx, 100));
tradingScene.action('close_50', (ctx) => prepClose(ctx, 50));
tradingScene.action('close_25', (ctx) => prepClose(ctx, 25));

// --- CONFIRMATION HANDLERS ---
tradingScene.action('cancel_action', async (ctx) => {
    const state = ctx.wizard.state as TradingState;
    delete state.pendingAction;
    await ctx.answerCbQuery('Cancelled');
    return renderTradingDashboard(ctx, state);
});

tradingScene.action('confirm_execution', async (ctx) => {
    const state = ctx.wizard.state as TradingState;
    const action = state.pendingAction;
    
    if (!action || !state.ticker) return;

    // Show loading transition
    try {
        await ctx.editMessageText(
            `⏳ **Executing Order...**\n` + 
            `Side: ${action.side}\n` +
            `Amount: $${action.amountUsd?.toFixed(2)}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        // Ignore edit errors
    }

    try {
        const userId = ctx.session.userId!;
        const exchangeId = ctx.session.activeExchange!;
        const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
        
        const price = parseFloat(state.ticker.lastPrice || state.ticker.price || '0');
        if (price === 0) throw new Error('Invalid price data from exchange');

        let quantity = 0;

        if (action.type === 'CLOSE') {
             // Close Logic: Calculate exact coin size based on % of position
             // Use Decimal for precision
             const posSize = Math.abs(parseFloat(state.position.size));
             quantity = posSize * (action.percent! / 100);
        } else {
             // Open/Add Logic: USD / Price
             // If Leverage: (USD * Lev) / Price ?
             const margin = action.amountUsd!;
             const notional = margin * state.leverage;
             quantity = notional / price;
        }

        // Round quantity
        quantity = parseFloat(quantity.toFixed(5));

        // Call Adapter - FIX: Use placeOrder, not createOrder
        const result = await adapter.placeOrder({
            symbol: state.symbol!,
            side: action.side === 'LONG' ? 'BUY' : 'SELL',
            type: state.orderType, 
            quantity: quantity.toString(),
            reduceOnly: action.isReduceOnly,
            leverage: state.leverage
        });

        await ctx.reply(
            `✅ **Order Executed!**\n\n` +
            `Type: ${action.side} ${state.symbol!}\n` +
            `Size: ${quantity.toFixed(4)} ${state.symbol}\n` +
            `Ref: \`${result.orderId}\``,
            { parse_mode: 'Markdown' }
        );

        // Reset and Refresh
        delete state.pendingAction;
        // Wait a moment for API propagation
        await new Promise(r => setTimeout(r, 1500));
        return stepHandler(ctx);

    } catch (error: any) {
        // Parse friendly error message
        let errMsg = error.message || 'Unknown error';
        if (errMsg.includes('insufficient margin')) errMsg = 'Insufficient Balance';
        if (errMsg.includes('Invalid price')) errMsg = 'Exchange rejected price';

        // Return to dashboard with error
        const msg = `❌ **Execution Failed**\n\nReason: ${errMsg}`;
        await ctx.reply(msg, { 
             parse_mode: 'Markdown',
             ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'refresh_trading')]])
        });
        delete state.pendingAction;
    }
});
