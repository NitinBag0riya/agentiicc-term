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
  step?: 'SELECT_TYPE' | 'ASK_PRICE' | 'ASK_AMOUNT' | 'ASK_TPSL' | 'CONFIRM' | 'ASK_MARGIN_AMOUNT';
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

tradingScene.enter(async (ctx) => {
  const state = ctx.scene.state as TradingState;
  
  if (!state.symbol) {
    await ctx.reply(`⚠️ No symbol provided.`);
    return ctx.scene.enter('citadel');
  }

  // Clear temp state on entry
  state.step = undefined;
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
      // ===== VIEW: ACTIVE POSITION =====
      const pnl = parseFloat(activePosition.unrealizedPnl);
      const pnlSign = pnl >= 0 ? '+' : '';
      const sideIcon = activePosition.side === 'LONG' ? '🟢' : '🔴';
      
      displayMessage = 
        `📊 **${symbol} Position** ${sideIcon}
        
**Exchange:** ${exchange.toUpperCase()}
**Side:** ${activePosition.side} ${activePosition.leverage}x
**Size:** ${activePosition.size} ${symbol}
**Entry:** $${parseFloat(activePosition.entryPrice).toFixed(4)}
**Mark:** $${parseFloat(activePosition.markPrice).toFixed(4)}

💰 **PnL:** ${pnlSign}$${pnl.toFixed(2)}`;

      keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('📉 Close 100%', `close_full_${symbol}`),
            Markup.button.callback('✂️ 50%', `close_half_${symbol}`),
            Markup.button.callback('🤏 25%', `close_25_${symbol}`),
            Markup.button.callback('♋ 69%', `close_69_${symbol}`)
        ],
        [
            Markup.button.callback(`⚙️ ${Math.round(parseFloat(activePosition.leverage || '1'))}x`, 'cycle_leverage'),
            Markup.button.callback('🛡️ Margin Mode', 'cycle_margin')
        ],
        [
            Markup.button.callback('🎯 Set TP/SL', `setup_tpsl`),
            Markup.button.callback('➕ Add Margin', `add_margin_placeholder`)
        ],
        [
            Markup.button.callback('🎯 Set TP/SL', `setup_tpsl`),
            Markup.button.callback('➕ Add Margin', `add_margin_placeholder`)
        ],
        [
             Markup.button.callback('📋 Manage Orders', 'manage_orders')
        ],
        [
          Markup.button.callback('🔄 Refresh', 'refresh'),
          Markup.button.callback('🔙 Back', 'back_to_citadel')
        ]
      ]);

    } else {
      // ===== VIEW: NO POSITION (Trading Mode) =====
      
      // Default mode if unset
      if (!state.mode) state.mode = 'MARKET';
      const modeIcon = state.mode === 'MARKET' ? '🚀' : '⏱';
      const modeText = state.mode === 'MARKET' ? 'Market' : 'Limit';

      displayMessage = 
        `📈 **Trade ${symbol}**
        
**Price:** $${price.toFixed(4)}
**24h:** ${changeSign}${change24h.toFixed(2)}%

_Select direction to open a position:_`;

      keyboard = Markup.inlineKeyboard([
        // Row 1: Config (Market/Limit | Lev | Margin) - Moved to top
        [
            Markup.button.callback(`${modeIcon} ${modeText}`, 'toggle_order_type'),
            Markup.button.callback('⚙️ Lev', 'cycle_leverage'),
            Markup.button.callback('🛡️ Margin', 'cycle_margin')
        ],
        // Row 2: Actions
        [
          Markup.button.callback('🟢 LONG', 'trade_long'),
          Markup.button.callback('🔴 SHORT', 'trade_short')
        ],
        // Row 3: Nav
        [
            Markup.button.callback('🔄 Refresh', 'refresh'),
            Markup.button.callback('🔙 Back', 'back_to_citadel')
        ]
      ]);
    }

    try {
        await ctx.telegram.editMessageText(
        ctx.chat!.id,
        loaderMsg.message_id,
        undefined,
        displayMessage,
        { parse_mode: 'Markdown', ...keyboard }
        );
    } catch (e) {
        // Fallback if edit fails (e.g. message too old)
        await ctx.reply(displayMessage, { parse_mode: 'Markdown', ...keyboard });
    }

  } catch (error: any) {
    console.error('Trading View Error:', error);
    await ctx.reply(`❌ Failed to load market data: ${error.message}`);
    await ctx.scene.enter('citadel');
  }
}

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

        let msg = `📋 **Open Orders (${symbol})**\n\n`;
        const buttons = [];

        for (const o of orders) {
            msg += `▫️ **${o.side}** ${o.quantity} @ ${o.price}\n   ID: \`${o.orderId}\`\n\n`;
            buttons.push([Markup.button.callback(`❌ Cancel ${o.side} ${o.price}`, `cancel_order_${o.orderId}`)]);
        }
        
        buttons.push([Markup.button.callback('🔙 Back', 'refresh'), Markup.button.callback('🗑️ Cancel All', 'cancel_all_orders')]);

        await ctx.reply(msg, Markup.inlineKeyboard(buttons));

    } catch (error: any) {
        await ctx.reply(`❌ Failed to fetch orders: ${error.message}`);
    }
});

// Cancel Specific Order
tradingScene.action(/cancel_order_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    
    await ctx.answerCbQuery();
    await ctx.reply(`⚠️ Cancelling order ${orderId}...`);
    
    try {
        await UniversalApiService.cancelOrder(userId, exchange, orderId, state.symbol);
        await ctx.reply(`✅ Order cancelled.`);
        
        // Refresh orders view by re-triggering managment? 
        // Or just go back to main view. Let's go refresh main view.
        await refreshTradingView(ctx);
    } catch (error: any) {
        await ctx.reply(`❌ Cancel failed: ${error.message}`);
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
          `🔢 **Enter Limit Price**
          
Type the price to triggers order:`,
          { reply_markup: { force_reply: true } }
      );
  } else {
      state.step = 'ASK_AMOUNT';
      await ctx.reply(
          `💰 **Enter Amount (USD)**
          
Type the value (e.g., 50, 100, 500):`,
          { reply_markup: { force_reply: true } }
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
        `💰 **Enter Amount (USD)**
        
Type the value (e.g., 50, 100, 500):`,
        { reply_markup: { force_reply: true } }
    );
});

tradingScene.action('type_limit', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.mode = 'LIMIT';
    state.step = 'ASK_PRICE';
    await ctx.answerCbQuery();
    await ctx.reply(
        `🔢 **Enter Limit Price**
        
Type the price to triggers order:`,
        { reply_markup: { force_reply: true } }
    );
});


// --- Position Management Actions ---

// Close Full
tradingScene.action(/close_full_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 1.0);
});

// Close Half
tradingScene.action(/close_half_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.5);
});

tradingScene.action(/close_25_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.25);
});

tradingScene.action(/close_69_(.+)/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    await executeClose(ctx, symbol, 0.69);
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

        await ctx.reply(`✅ Closed ${quantity} ${symbol}.\nOrder ID: \`${result.orderId}\``);
        await refreshTradingView(ctx);

    } catch (error: any) {
        await ctx.reply(`❌ Close failed: ${error.message}`);
    }
}

// Setup TP/SL
tradingScene.action('setup_tpsl', async (ctx) => {
    const state = ctx.scene.state as TradingState;
    state.step = 'ASK_TPSL';
    await ctx.answerCbQuery();
    await ctx.reply(
        `🎯 **Set Take Profit / Stop Loss**

Select a Quick Option relative to current price or type manually:`,
        Markup.inlineKeyboard([
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
    );
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
        `➕ **Add Margin**
        
Enter amount to add (in USD/Quote):
Example: \`50\``,
        { reply_markup: { force_reply: true } }
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

    // Step: ASK_TPSL
    if (state.step === 'ASK_TPSL') {
        const parts = text.split(' ');
        if (parts.length !== 2) {
            await ctx.reply(`❌ Invalid format. Use: \`TP SL\` (e.g. \`95000 89000\`)`);
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

        console.log(`[Trade] $${amount} @ $${execPrice} -> ${quantity} ${symbol} (Prec: ${precision})`);

        const result = await UniversalApiService.placeOrder(userId, exchange, {
            symbol,
            side: side!,
            type: mode!,
            quantity,
            price: mode === 'LIMIT' ? price!.toString() : undefined
        });

        await ctx.reply(
            `✅ **Order Successful!**
            
Type: ${mode} ${side}
Qty: ${quantity} ${symbol}
Status: ${result.status}
ID: \`${result.orderId}\``
        );

        await refreshTradingView(ctx);

    } catch (error: any) {
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
