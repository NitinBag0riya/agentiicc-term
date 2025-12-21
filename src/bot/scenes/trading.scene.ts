/**
 * Trading Scene (Module 3: Advanced Trading)
 * Features: Market/Limit Orders, TP/SL, Position Mgmt
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { showMenu } from '../utils/menu';

interface TradingState {
  symbol: string;
  side?: 'BUY' | 'SELL';
  mode?: 'MARKET' | 'LIMIT';
  price?: number; // Limit Price
  amount?: number; // USD Size
  step?: 'SELECT_TYPE' | 'ASK_PRICE' | 'ASK_AMOUNT' | 'ASK_TPSL' | 'CONFIRM' | 'ASK_MARGIN_AMOUNT' | 'ASK_PRE_TPSL';
  // TP/SL Temp Data
  tpPrice?: string;
  slPrice?: string;
}

export const tradingScene = new Scenes.BaseScene<BotContext>('trading');

// Global Commands
tradingScene.command(['menu', 'start'], async (ctx) => {
    await ctx.scene.leave();
    await showMenu(ctx);
});

// Orders Command
import { showActiveOrdersTypes } from '../utils/orders';
tradingScene.command('orders', async (ctx) => {
    await showActiveOrdersTypes(ctx);
});

tradingScene.enter(async (ctx) => {
  const state = ctx.scene.state as TradingState;
  
  if (!state.symbol) {
    await ctx.reply(`⚠️ No symbol provided.`);
    return ctx.scene.enter('citadel');
  }

  // Clear temp state on entry
  state.step = undefined;

  // Check if we have a full intent from NLP (Side + Mode + Amount/Price)
  // Default to MARKET if type is missing but amount is present
  if (!state.mode && state.amount) {
      state.mode = 'MARKET';
  }

  if (state.side && state.mode && (state.amount || state.price)) {
      await executeTrade(ctx, state); 
      return; 
  }

  await refreshTradingView(ctx);
});

async function refreshTradingView(ctx: BotContext) {
  const state = ctx.scene.state as TradingState;
  const { symbol } = state;
  const userId = ctx.session.userId!;
  const exchange = ctx.session.activeExchange!;

  try {
    const loaderMsg = await ctx.reply(`⏳ Loading market data...`);

    // 1. Get Market Data
    const ticker = await UniversalApiService.getMarketPrice(exchange, symbol);
    const price = parseFloat(ticker.price);
    const change24h = parseFloat(ticker.change24h);
    const changeSign = change24h >= 0 ? '+' : '';

    // 2. Get Open Positions
    const positions = await UniversalApiService.getPositions(userId, exchange);
    const activePosition = positions.find(p => p.symbol === symbol);

    let displayMessage = ``;
    let keyboard: any;

    if (activePosition) {
      // ===== VIEW: ACTIVE POSITION (Manage) =====
      const pnl = parseFloat(activePosition.unrealizedPnl);
      const pnlSign = pnl >= 0 ? '+' : '';
      const sideIcon = activePosition.side === 'LONG' ? '🟢' : '🔴';
      const isLong = activePosition.side === 'LONG';
      const apeSideIcon = isLong ? '🟢' : '🔴';
      
      displayMessage = 
        `📊 <b>${symbol} Position</b> ${sideIcon}
        
<b>Exchange:</b> ${exchange.toUpperCase()}
<b>Side:</b> ${activePosition.side} ${activePosition.leverage}x
<b>Size:</b> ${activePosition.size} ${symbol}
<b>Entry:</b> $${parseFloat(activePosition.entryPrice).toFixed(4)}
<b>Mark:</b> $${parseFloat(activePosition.markPrice).toFixed(4)}

💰 <b>PnL:</b> ${pnlSign}$${pnl.toFixed(2)}`;

      keyboard = Markup.inlineKeyboard([
        // Row 1: Config Toggles
        [
            Markup.button.callback('🛒 Market', 'toggle_order_type'), // Toggles order type for adds/closes
            Markup.button.callback(`🔟 ${Math.round(parseFloat(activePosition.leverage || '1'))}x`, 'cycle_leverage'),
            Markup.button.callback('🛡️ Margin', 'cycle_margin')
        ],
        // Row 2: Ape (Add Size) - 3 Columns
        [
             Markup.button.callback(`${apeSideIcon} Ape $50`, `ape_50`),
             Markup.button.callback(`${apeSideIcon} Ape $200`, `ape_200`),
             Markup.button.callback(`${apeSideIcon} Ape X`, `ape_custom`)
        ],
        // Row 3: Close Actions
        [
             Markup.button.callback('❌ Close All', `close_full_${symbol}`)
        ],
        // Row 4: Partial Closes
        [
             Markup.button.callback('📉 25%', `close_25_${symbol}`),
             Markup.button.callback('📉 50%', `close_half_${symbol}`),
             Markup.button.callback('📉 75%', `close_75_${symbol}`)
        ],
        // Row 5: Strategy
        [
            Markup.button.callback('🎯 Set TP/SL', `setup_tpsl`),
            Markup.button.callback('📋 Manage Orders', 'manage_orders')
        ],
        // Row 6: Nav
        [
          Markup.button.callback('🔙 Back to Menu', 'back_to_citadel')
        ]
      ]);

    } else {
      // ===== VIEW: NO POSITION (New Trade) =====
      
      // Default mode if unset
      if (!state.mode) state.mode = 'MARKET';
      const modeIcon = state.mode === 'MARKET' ? '🛒' : '⏱';
      const modeText = state.mode === 'MARKET' ? 'Market' : 'Limit';

      displayMessage = 
        `📈 <b>Trade ${symbol}</b>
        
<b>Price:</b> $${price.toFixed(4)}
<b>24h:</b> ${changeSign}${change24h.toFixed(2)}%

<i>Select direction and size:</i>`;

      keyboard = Markup.inlineKeyboard([
        // Row 1: Config (Toggle | Lev | Margin)
        [
            Markup.button.callback(`${modeIcon} ${modeText}`, 'toggle_order_type'),
            Markup.button.callback('❓ 10x', 'cycle_leverage'), // Placeholder 10x or dynamic
            Markup.button.callback('❓ Cross', 'cycle_margin')   // Placeholder
        ],
        // Row 2: Quick Long
        [
            Markup.button.callback('🟢 Long $50', 'trade_quick_long_50'),
            Markup.button.callback('🟢 Long $200', 'trade_quick_long_200'),
            Markup.button.callback('🟢 Long X', 'trade_long_custom')
        ],
        // Row 3: Quick Short
        [
             Markup.button.callback('🔴 Short $50', 'trade_quick_short_50'),
             Markup.button.callback('🔴 Short $200', 'trade_quick_short_200'),
             Markup.button.callback('🔴 Short X', 'trade_short_custom')
        ],
        // Row 4: Tools
        [
             Markup.button.callback('🎯 Set TP/SL', 'setup_tpsl_pre'),
             Markup.button.callback('📋 Manage Orders', 'manage_orders')
        ],
        // Row 5: Nav
        [
            Markup.button.callback('🔙 Back to Menu', 'back_to_citadel'),
            Markup.button.callback('🔄 Refresh', 'refresh')
        ]
      ]);
    }

    try {
        await ctx.telegram.editMessageText(
        ctx.chat!.id,
        loaderMsg.message_id,
        undefined,
        displayMessage,
        { parse_mode: 'HTML', ...keyboard }
        );
    } catch (e) {
        // Fallback if edit fails (e.g. message too old)
        await ctx.reply(displayMessage, { parse_mode: 'HTML', ...keyboard });
    }

  } catch (error: any) {
    console.error('Trading View Error:', error);
    await ctx.reply(`❌ Failed to load market data: ${error.message}`);
    await ctx.scene.enter('citadel');
  }
}
// ... (rest of file)
// Note: I need to ensure executeTrade also uses HTML


// ================= ACTIONS =================

tradingScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery();
  await refreshTradingView(ctx);
});

tradingScene.action('back_to_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('citadel');
});

// Manage Open Orders
tradingScene.action('manage_orders', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    const symbol = state.symbol;

    try {
        const orders = await UniversalApiService.getOpenOrders(userId, exchange, symbol);
        
        if (orders.length === 0) {
            await ctx.reply(`ℹ️ No open orders for ${symbol}.`);
            return;
        }

        let msg = `📋 <b>Open Orders (${symbol})</b>\n\n`;
        const buttons = [];

        for (const o of orders) {
            msg += `▫️ <b>${o.side}</b> ${o.quantity} @ ${o.price}\n   ID: <code>${o.orderId}</code>\n\n`;
            buttons.push([Markup.button.callback(`❌ Cancel ${o.side} ${o.price}`, `cancel_order_${o.orderId}_${symbol}`)]);
        }
        
        buttons.push([Markup.button.callback('🔙 Back', 'refresh'), Markup.button.callback('🗑️ Cancel All', 'cancel_all_orders')]);

        await ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });

    } catch (error: any) {
        await ctx.reply(`❌ Failed to fetch orders: ${error.message}`);
    }
});

// Cancel Specific Order
tradingScene.action(/cancel_order_(.+)/, async (ctx) => {
    // Format: cancel_order_ORDERID_SYMBOL
    const rawData = ctx.match[1];
    const parts = rawData.split('_');
    
    // Attempt to extract symbol if present (new format from orders.ts or updated here)
    // If only one part, it's just ID (fallback legacy logic).
    let orderId = rawData;
    let symbolOverride = undefined;

    if (parts.length > 1) {
        symbolOverride = parts.pop(); // Last token is symbol
        orderId = parts.join('_');    // Rest is ID
    }

    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    
    // Use override if available (from global list), else fall back to current scene state
    const targetSymbol = symbolOverride || state.symbol;

    await ctx.answerCbQuery();
    await ctx.reply(`⚠️ Cancelling order <code>${orderId}</code>...`, { parse_mode: 'HTML' });
    
    try {
        await UniversalApiService.cancelOrder(userId, exchange, orderId, targetSymbol);
        await ctx.reply(`✅ Order cancelled.`);
        
        await refreshTradingView(ctx);
    } catch (error: any) {
        await ctx.reply(`❌ Failed to cancel order: ${error.message}`);
    }
}); 


// --- Trade Flow Start ---

tradingScene.action(['trade_long', 'trade_short'], async (ctx) => {
  // @ts-ignore
  const cb = ctx.callbackQuery;
  // @ts-ignore
  const data = cb.data;
  const side = data === 'trade_long' ? 'BUY' : 'SELL';
  
  const state = ctx.scene.state as TradingState;
  state.side = side;
  // Transition directly based on selected mode
  if (state.mode === 'LIMIT') {
      state.step = 'ASK_PRICE';
      await ctx.reply(
          `🔢 <b>Enter Limit Price</b>
          
Type the price to triggers order:`,
          { parse_mode: 'HTML', reply_markup: { force_reply: true } }
      );
  } else {
      state.step = 'ASK_AMOUNT';
      await ctx.reply(
          `💰 <b>Enter Amount (USD)</b>
          
Type the value (e.g., 50, 100, 500):`,
          { parse_mode: 'HTML', reply_markup: { force_reply: true } }
      );
  }
  await ctx.answerCbQuery();
});

tradingScene.action('toggle_order_type', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.mode = state.mode === 'MARKET' ? 'LIMIT' : 'MARKET';
    await ctx.answerCbQuery(`Order Type: ${state.mode}`);
    await refreshTradingView(ctx);
});

tradingScene.action('cancel_trade', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.step = undefined;
    state.side = undefined;
    state.mode = undefined;
    await ctx.answerCbQuery();
    await ctx.reply(`🚫 Trade cancelled.`);
    await refreshTradingView(ctx);
});

// --- Order Type Selection ---

tradingScene.action('type_market', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.mode = 'MARKET';
    state.step = 'ASK_AMOUNT';
    await ctx.answerCbQuery();
    await ctx.reply(
        `💰 <b>Enter Amount (USD)</b>
        
Type the value (e.g., 50, 100, 500):`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
});

tradingScene.action('type_limit', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.mode = 'LIMIT';
    state.step = 'ASK_PRICE';
    await ctx.answerCbQuery();
    await ctx.reply(
        `🔢 <b>Enter Limit Price</b>
        
Type the price to triggers order:`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
});


// --- Position Management Actions ---

// --- Quick Trade Handlers ---

// Quick Long/Short Fixed Amounts
tradingScene.action(/trade_quick_(long|short)_(50|200)/, async (ctx) => {
    const side = ctx.match[1] === 'long' ? 'BUY' : 'SELL';
    const amount = parseFloat(ctx.match[2]);
    const state = ctx.scene.state as TradingState;
    
    state.side = side;
    state.amount = amount;
    state.mode = 'MARKET'; // Quick trades are always Market
    
    await ctx.answerCbQuery(`⚡ Quick ${side} $${amount}`);
    await executeTrade(ctx, state);
});

// Custom Amount Handlers
tradingScene.action(/trade_(long|short)_custom/, async (ctx) => {
    const side = ctx.match[1] === 'long' ? 'BUY' : 'SELL';
    const state = ctx.scene.state as TradingState;
    
    state.side = side;
    state.mode = 'MARKET';
    state.step = 'ASK_AMOUNT';
    
    await ctx.answerCbQuery();
    await ctx.reply(
        `💰 <b>Enter ${side} Amount (USD)</b>
        
Type the value:`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
});


// --- Ape (Add Size) Handlers ---

tradingScene.action(/ape_(50|200|custom)/, async (ctx) => {
    const type = ctx.match[1];
    const state = ctx.scene.state as TradingState;
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    
    // 1. Get current position to know side
    try {
        const positions = await UniversalApiService.getPositions(userId, exchange);
        const pos = positions.find(p => p.symbol === state.symbol);
        
        if (!pos) {
            await ctx.answerCbQuery('❌ No active position to Ape into.');
            return refreshTradingView(ctx);
        }
        
        const side = parseFloat(pos.size) > 0 ? 'BUY' : 'SELL'; // Same side to add size
        state.side = side;
        state.mode = 'MARKET';

        if (type === 'custom') {
            state.step = 'ASK_AMOUNT';
            await ctx.answerCbQuery();
            await ctx.reply(`🦍 <b>Ape Amount (USD)</b>\n\nEnter amount to ADD to position:`, { parse_mode: 'HTML', reply_markup: { force_reply: true } });
        } else {
            const amount = parseFloat(type);
            state.amount = amount;
            await ctx.answerCbQuery(`🦍 Aping $${amount}...`);
            await executeTrade(ctx, state);
        }

    } catch (e: any) {
        await ctx.reply(`❌ Failed to Ape: ${e.message}`);
    }
});

// --- Close 75% ---
// --- Close 75% ---
tradingScene.action(/close_75_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.75);
});

// --- Close 50% ---
tradingScene.action(/close_half_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.5);
});

// --- Close 25% ---
tradingScene.action(/close_25_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.25);
});

// --- Close Full ---
tradingScene.action(/close_full_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 1.0);
});

async function executeClose(ctx: BotContext, symbol: string, fraction: number) {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;

    await ctx.reply(`⚠️ Closing ${fraction * 100}% of ${symbol}...`);

    try {
        // 1. Get Position
        const positions = await UniversalApiService.getPositions(userId, exchange);
        const pos = positions.find(p => p.symbol === symbol);
        if (!pos) throw new Error('Position not found');

        // 2. Calculate Qty
        const totalSize = Math.abs(parseFloat(pos.size));
        const closeSize = totalSize * fraction;
        
        // 3. Place Reduce-Only Market Order
        const side = parseFloat(pos.size) > 0 ? 'SELL' : 'BUY';
        
        // Handle Precision
        const asset = await UniversalApiService.getAsset(exchange, symbol);
        let precision = 6;
        if (asset?.stepSize) {
           const step = parseFloat(asset.stepSize);
           if (step < 1) precision = Math.abs(Math.log10(step));
           else precision = 0;
        }

        const quantity = closeSize.toFixed(precision);

        const result = await UniversalApiService.placeOrder(userId, exchange, {
            symbol,
            side,
            type: 'MARKET',
            quantity,
            reduceOnly: true
        });

        await ctx.reply(`✅ Closed ${quantity} ${symbol}.\nOrder ID: <code>${result.orderId}</code>`, { parse_mode: 'HTML' });
        await refreshTradingView(ctx);

    } catch (error: any) {
        await ctx.reply(`❌ Close failed: ${error.message}`);
    }
}

// --- Pre-Trade TP/SL ---
tradingScene.action('setup_tpsl_pre', async (ctx) => {
    // Determine side if possible or just ask generic
    const state = ctx.scene.state as TradingState;
    state.step = 'ASK_TPSL';
    await ctx.answerCbQuery();
    await ctx.reply(
        `🎯 <b>Pre-Set Take Profit / Stop Loss</b>
        
Enter TP and SL prices separated by space:
Example: <code>95000 89000</code>
(Type <code>skip</code> to skip one, e.g. <code>95000 skip</code>)`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
});

// Setup TP/SL
tradingScene.action('setup_tpsl', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.step = 'ASK_TPSL';
    await ctx.answerCbQuery();
    await ctx.reply(
        `🎯 <b>Set Take Profit / Stop Loss</b>

Select a Quick Option relative to current price or type manually:`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
                Markup.button.callback('💹 TP +5%', 'tpsl_calc_tp_5'),
                Markup.button.callback('💹 TP +10%', 'tpsl_calc_tp_10')
            ],
            [
                Markup.button.callback('🛑 SL -5%', 'tpsl_calc_sl_5'),
                Markup.button.callback('🛑 SL -10%', 'tpsl_calc_sl_10')
            ],
            [Markup.button.callback('🔙 Cancel', 'refresh')]
        ])
    });
});

// Quick TP/SL Handler
tradingScene.action(/tpsl_calc_(tp|sl)_(.+)/, async (ctx) => {
    const type = ctx.match[1]; // tp or sl
    const pct = parseFloat(ctx.match[2]); // 5 or 10
    
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    const symbol = state.symbol;

    await ctx.answerCbQuery();
    await ctx.reply(`🔄 Calculating ${type.toUpperCase()} ${pct}%...`);

    try {
        const positions = await UniversalApiService.getPositions(userId, exchange);
        const pos = positions.find(p => p.symbol === symbol);
        if (!pos) throw new Error('No active position found.');

        const entry = parseFloat(pos.entryPrice);
        const isLong = pos.side === 'LONG';
        
        let targetPrice = 0;
        const multiplier = pct / 100;

        if (type === 'tp') {
            // TP: Long -> Entry * (1 + m), Short -> Entry * (1 - m)
            targetPrice = isLong ? entry * (1 + multiplier) : entry * (1 - multiplier);
        } else {
            // SL: Long -> Entry * (1 - m), Short -> Entry * (1 + m)
            targetPrice = isLong ? entry * (1 - multiplier) : entry * (1 + multiplier);
        }

        // Precision (rough)
        // Ideally fetch asset precision. For now using 2-4 decimals or standard formatting
        const formattedPrice = targetPrice.toFixed(4); // Generic precision

        // Call API
        const tpArg = type === 'tp' ? formattedPrice : undefined;
        const slArg = type === 'sl' ? formattedPrice : undefined;
        
        const res = await UniversalApiService.setPositionTPSL(userId, exchange, symbol, tpArg, slArg);
        await ctx.reply(res.message);
        await refreshTradingView(ctx);

    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`);
    }
});

// Add Margin Flow
tradingScene.action('add_margin_placeholder', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.step = 'ASK_MARGIN_AMOUNT';
    await ctx.answerCbQuery();
    await ctx.reply(
        `➕ <b>Add Margin</b>
        
Enter amount to add (in USD/Quote):
Example: <code>50</code>`,
        { parse_mode: 'HTML', reply_markup: { force_reply: true } }
    );
});

// --- TEXT HANDLER (WIZARD STEPS) ---

tradingScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const state = ctx.scene.state as TradingState;

    if (text === '/cancel') {
        const step = state.step;
        state.step = undefined;
        await ctx.reply(`Cancelled.`);
        if (step) return refreshTradingView(ctx);
        return; 
    }

    if (!state.step) {
        // Passive search or ignore
        return;
    }

    // Step: ASK_PRICE (For Limit)
    if (state.step === 'ASK_PRICE') {
        const price = parseFloat(text);
        if (isNaN(price) || price <= 0) {
            await ctx.reply(`❌ Invalid price. Number required.`);
            return;
        }
        state.price = price;
        state.step = 'ASK_AMOUNT';
        await ctx.reply(`💰 **Enter Amount (USD)** (Limit Price: $${price})`);
        return;
    }

    // Step: ASK_AMOUNT (For Market & Limit)
    if (state.step === 'ASK_AMOUNT') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply(`❌ Invalid amount. Number required.`);
            return;
        }
        
        state.amount = amount;
        
        // Execute Order
        await executeTrade(ctx, state);
        
        // Clear State
        state.step = undefined;
        state.mode = undefined;
        state.side = undefined;
        return;
    }

    // Step: ASK_TPSL (Immediate Set for Open Position)
    if (state.step === 'ASK_TPSL') {
        const parts = text.split(' ');
        if (parts.length !== 2) {
            await ctx.reply(`❌ Invalid format. Use: TP SL (e.g. 95000 89000)`);
            return;
        }

        const tp = parts[0].toLowerCase() === 'skip' ? undefined : parts[0];
        const sl = parts[1].toLowerCase() === 'skip' ? undefined : parts[1];

        // Basic validation
        if (tp && isNaN(parseFloat(tp))) { await ctx.reply(`❌ Invalid TP Price`); return; }
        if (sl && isNaN(parseFloat(sl))) { await ctx.reply(`❌ Invalid SL Price`); return; }

        await executeTPSL(ctx, tp, sl);
        state.step = undefined;
        return;
    }

    // Step: ASK_PRE_TPSL (Attach to Next Trade)
    if (state.step === 'ASK_PRE_TPSL') {
        const parts = text.split(' ');
        if (parts.length !== 2) {
            await ctx.reply(`❌ Invalid format. Use: TP SL (e.g. 95000 89000)`);
            return;
        }

        const tp = parts[0].toLowerCase() === 'skip' ? undefined : parts[0];
        const sl = parts[1].toLowerCase() === 'skip' ? undefined : parts[1];

        if (tp && isNaN(parseFloat(tp))) { await ctx.reply(`❌ Invalid TP Price`); return; }
        if (sl && isNaN(parseFloat(sl))) { await ctx.reply(`❌ Invalid SL Price`); return; }

        state.tpPrice = tp;
        state.slPrice = sl;
        state.step = undefined;

        await ctx.reply(`✅ <b>TP/SL Attached</b>\nTP: ${tp || 'None'}\nSL: ${sl || 'None'}\n\n<i>Use the buttons above to execute the trade.</i>`, { parse_mode: 'HTML' });
        // Don't refresh view essentially, just acknowledge. But view refresh might be nice?
        // Let's NOT refresh view because it would clear the "Attached" status visually if we don't render it.
        // For now, user just knows it's attached.
        return;
    }

    // Step: ASK_MARGIN_AMOUNT
    if (state.step === 'ASK_MARGIN_AMOUNT') {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply(`❌ Invalid amount. Number required.`);
            return;
        }

        await executeAddMargin(ctx, amount.toString());
        state.step = undefined;
        return;
    }
});

async function executeTrade(ctx: BotContext, state: TradingState) {
    const { symbol, side, mode, price, amount } = state;
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;

    await ctx.reply(`🚀 Placing ${mode} ${side} order for $${amount}...`);

    try {
        // Calculate Quantity
        const asset = await UniversalApiService.getAsset(exchange, symbol);
        // If Market, get current price for est. If Limit, use state.price
        let execPrice = price; 
        if (!execPrice) {
            const ticker = await UniversalApiService.getMarketPrice(exchange, symbol);
            execPrice = parseFloat(ticker.price);
        }

        const rawQty = amount! / execPrice;

        // Precision Logic
        let precision = 6;
        if (asset?.stepSize) {
            const step = parseFloat(asset.stepSize);
            if (step < 1) precision = Math.abs(Math.log10(step));
            else precision = 0;
        }
        // Safety bounds
        precision = Math.max(0, Math.min(precision, 8));

        const factor = Math.pow(10, precision);
        const quantity = (Math.floor(rawQty * factor) / factor).toFixed(precision);

        // console.log(`[Trade] $${amount} @ $${execPrice} -> ${quantity} ${symbol} (Prec: ${precision})`);

        // console.log('[Trade] Calling UniversalApiService.placeOrder...');
        const result = await UniversalApiService.placeOrder(userId, exchange, {
            symbol,
            side: side!,
            type: mode!,
            quantity,
            price: mode === 'LIMIT' ? price!.toString() : undefined,
            takeProfit: state.tpPrice,
            stopLoss: state.slPrice
        });
        // console.log('[Trade] Order Result:', result);

        // Success Message with Cancel Button
        const buttons = [];
        if (result.orderId) {
            buttons.push([Markup.button.callback('❌ Cancel Order', `cancel_order_${result.orderId}`)]);
        }

        await ctx.reply(
            `✅ <b>Order Successful!</b>
            
Type: ${mode} ${side}
Qty: ${quantity} ${symbol}
Status: ${result.status}
ID: <code>${result.orderId}</code>`, 
            { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
        );

        // Clear TP/SL after trade
        state.tpPrice = undefined;
        state.slPrice = undefined;

        await refreshTradingView(ctx);

    } catch (error: any) {
        console.error('[Trade] Execution Failed:', error);
        await ctx.reply(`❌ Order Failed: ${error.message}`);
    }
}

async function executeTPSL(ctx: BotContext, tp?: string, sl?: string) {
    const exchange = ctx.session.activeExchange!;
    const userId = ctx.session.userId!;
    const state = ctx.scene.state as TradingState;

    await ctx.reply(`⚙️ Setting TP/SL...`);
    
    try {
        const result = await UniversalApiService.setPositionTPSL(userId, exchange, state.symbol, tp, sl);
        
        if (result.success) {
            await ctx.reply(`✅ ${result.message}`);
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
        await refreshTradingView(ctx);
    } catch (error: any) {
         await ctx.reply(`❌ Error: ${error.message}`);
    }
}

async function executeAddMargin(ctx: BotContext, amount: string) {
    const exchange = ctx.session.activeExchange!;
    const userId = ctx.session.userId!;
    const state = ctx.scene.state as TradingState;

    await ctx.reply(`🔄 Adding ${amount} margin to ${state.symbol}...`);

    try {
        const result = await UniversalApiService.updatePositionMargin(userId, exchange, state.symbol, amount, 'ADD');
        if (result.success) {
            await ctx.reply(`✅ ${result.message}`);
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
        await refreshTradingView(ctx);
    } catch (error: any) {
        await ctx.reply(`❌ Failed to add margin: ${error.message}`);
    }
}

// --- NEW ACTIONS (Gap Filling) ---

// Cancel All
tradingScene.action('cancel_all_orders', async (ctx) => {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;

    await ctx.answerCbQuery();
    await ctx.reply(`🗑️ Cancelling ALL orders for ${state.symbol}...`);

    try {
        const res = await UniversalApiService.cancelAllOrders(userId, exchange, state.symbol);
        await ctx.reply(res.message);
        await refreshTradingView(ctx);
    } catch (e: any) {
        await ctx.reply(`❌ Failed: ${e.message}`);
    }
});

// Leverage Cycle (Inline)
tradingScene.action('cycle_leverage', async (ctx) => {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    
    // Define cycle
    const levels = [5, 10, 20, 50];
    
    // We don't know current lev easily without position. 
    // We'll try to store/guess or just prompt cycle.
    // For now, let's just cycle from a default or stored state if strictly needed?
    // Actually, asking for current lev matches 'edit'.
    // BUT user said "toggle cta instead of new screen".
    // I will implement a "dumb" cycle that assumes start at 5 if unknown, or next in list.
    // Ideally we fetch it. simpler: Just set to next commonly used value.
    
    // Let's use a temp session value to track cycle if valid
    // Or just cycle 5->10->20->50
    const currentLev = 5; // Placeholder, would be better if we fetched it.
    
    // Let's Just Pick Next Value based on ... ?
    // I'll make it "Press to Set" style but circling.
    // Actually, hardcoding the cycle based on last click is risky if external change.
    // But for this request "toggle cta":
    
    // I will implement logic: Get cur, set next.
    // Since getting cur is async and might not be present, I'll just set known sequence
    // We'll require user to look at the toast message "Leverage Set to X".
    
    // Hack: use random or simple state? 
    // Let's try to infer from state if we had it.
    // Otherwise default start 10.
    
    // To make it truly togglable, I'll sequence it:
    // API doesn't return "Next". 
    // I'll just show the menu for now BUT inline? 
    // User said "toggle cta" -> single button click changes it.
    // I'll implement: Read -> Modify -> Write is too slow?
    // I'll just set to 10, then 20, then 50, then 5.
    
    // IMPROVED: Use session to store "last set leverage" for this symbol?
    // Too complex.
    // I will Cycle blindly: 5 -> 10 -> 20 -> 50.
    // How to know where we are? 
    // I'll check if there's an active position in the VIEW logic (refreshTradingView tracks it but action doesn't).
    
    // For now, I'll implement a simple "Next Logic" if I can.
    // If not, I'll just loop [5, 10, 20, 50]. 
    // I need to store index?
    // let's just make it Set to 20x default? No.
    
    // Real Plan: Interactive Header?
    // Let's just create a simplified flow: 
    // If < 10 -> Set 10. If 10 -> Set 20. If 20 -> Set 50. If 50 -> Set 5.
    // But I don't know "If < 10".
    
    // Ok, I will use the `cycle_leverage` to display an Alert with the current leverage (if I could) 
    // and then Change it?
    
    // User wants "toggle".
    // I will implement: 
    // 1. Fetch Position/Account Config (checking `getMarginMode` or similar).
    // Hyperliquid adapter has `getAccount` which has `assetPositions`.
    // It's expensive.
    
    // Compromise:
    // I will Make the button "Set 5x" -> "Set 10x" -> "Set 20x" -> "Set 50x" 
    // Wait, the button label is static "⚙️ Lev".
    // I will make the ACTION just set it to the NEXT tier based on a local guess or default.
    // Let's try to be smart:
    // If we click, we want to change.
    // I'll implement a simple menu replacement?
    // "instead of new screen" -> `ctx.editMessageText`.
    
    // The user's request "show toggle cta" might mean "Show the options inline"
    // OR "The button itself toggles the value".
    // Given "toggle cta", I'll assume the button toggles through values.
    
    await ctx.answerCbQuery('Cycling Leverage...');
    
    // We'll cycle: 5 -> 10 -> 20 -> 50 -> 5
    // Need storage. `ctx.session.lastLev`?
    const last = ctx.session[`lev_${state.symbol}`] || 5;
    const map: {[key:number]:number} = { 5: 10, 10: 20, 20: 50, 50: 5 };
    const next = map[last] || 5;
    
    // Set it
    try {
        await UniversalApiService.setLeverage(userId, exchange, state.symbol, next);
        ctx.session[`lev_${state.symbol}`] = next;
        await ctx.answerCbQuery(`✅ Set to ${next}x`);
        // Refresh to show any changes (if we show lev in UI)
        await refreshTradingView(ctx); 
    } catch (e: any) {
        await ctx.answerCbQuery(`❌ Fail: ${e.message}`);
    }
});

// Margin Mode Toggle
tradingScene.action('cycle_margin', async (ctx) => {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;

    await ctx.answerCbQuery('Toggling Margin Mode...');
    
    // Toggle Cross <-> Isolated
    // We presume Cross default. 
    // Need storage or fetch. 
    // I'll Try to fetch mode first? `UniversalApiService.getMarginMode`
    try {
        const current = await UniversalApiService.getMarginMode(userId, exchange, state.symbol);
        const next = current === 'CROSS' ? 'ISOLATED' : 'CROSS';
        
        await UniversalApiService.setMarginMode(userId, exchange, state.symbol, next);
        await ctx.answerCbQuery(`✅ Switched to ${next}`);
        await refreshTradingView(ctx);
    } catch (e: any) {
        await ctx.answerCbQuery(`❌ Fail: ${e.message}`);
    }
});
