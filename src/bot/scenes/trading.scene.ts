/**
 * Trading Scene (Module 3: Advanced Trading)
 * Features: Market/Limit Orders, TP/SL, Position Mgmt
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

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
      displayMessage = 
        `📈 **Trade ${symbol}**
        
**Price:** $${price.toFixed(4)}
**24h:** ${changeSign}${change24h.toFixed(2)}%

_Select direction to open a position:_`;

      keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🟢 LONG', 'trade_long'),
          Markup.button.callback('🔴 SHORT', 'trade_short')
        ],
        [
            Markup.button.callback('⚙️ Leverage', 'cycle_leverage'),
            Markup.button.callback('🛡️ Margin Mode', 'cycle_margin')
        ],
        [Markup.button.callback('🔄 Refresh', 'refresh')],
        [Markup.button.callback('🔙 Back', 'back_to_citadel')]
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
  state.step = 'SELECT_TYPE';

  await ctx.reply(
    `⚙️ **Order Configuration**
    
Side: **${side}**

Choose Order Type:`,
    Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Market', 'type_market')],
        [Markup.button.callback('⏱ Limit', 'type_limit')],
        [Markup.button.callback('❌ Cancel', 'cancel_trade')]
    ])
  );
  await ctx.answerCbQuery();
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

// Leverage Cycle
tradingScene.action('cycle_leverage', async (ctx) => {
    await ctx.answerCbQuery();
    // Prompt for leverage or cycle
    // Simple cycle: 5 -> 10 -> 20 -> 50 -> 5 ...
    // Or just Ask.
    await ctx.reply('⚙️ **Select Leverage:**', Markup.inlineKeyboard([
        [
            Markup.button.callback('5x', 'set_lev_5'),
            Markup.button.callback('10x', 'set_lev_10'),
            Markup.button.callback('20x', 'set_lev_20'),
            Markup.button.callback('50x', 'set_lev_50')
        ],
        [Markup.button.callback('🔙 Cancel', 'cancel_lev')]
    ]));
});

tradingScene.action(/set_lev_(.+)/, async (ctx) => {
    const lev = parseInt(ctx.match[1]);
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    
    await ctx.answerCbQuery();
    await ctx.reply(`⚙️ Setting leverage to ${lev}x...`);
    
    try {
        const res = await UniversalApiService.setLeverage(userId, exchange, state.symbol, lev);
        await ctx.reply(res.message || '✅ Leverage Updated');
        // Delete menu or refresh
        await refreshTradingView(ctx);
    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`);
    }
});

tradingScene.action('cancel_lev', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
});

// Margin Mode Cycle
tradingScene.action('cycle_margin', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('🛡️ **Select Margin Mode:**', Markup.inlineKeyboard([
        [
            Markup.button.callback('⚔️ Cross', 'set_margin_cross'),
            Markup.button.callback('🏝️ Isolated', 'set_margin_isolated')
        ],
        [Markup.button.callback('🔙 Cancel', 'cancel_margin')]
    ]));
});

tradingScene.action('set_margin_cross', async (ctx) => {
    await setMarginMode(ctx, 'CROSS');
});

tradingScene.action('set_margin_isolated', async (ctx) => {
    await setMarginMode(ctx, 'ISOLATED');
});

tradingScene.action('cancel_margin', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
});

async function setMarginMode(ctx: BotContext, mode: 'CROSS' | 'ISOLATED') {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    const state = ctx.scene.state as TradingState;
    
    await ctx.reply(`🛡️ Setting ${mode} Margin...`);
    try {
        const res = await UniversalApiService.setMarginMode(userId, exchange, state.symbol, mode);
        await ctx.reply(res.message || '✅ Margin Mode Updated');
        await refreshTradingView(ctx);
    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`);
    }
}
