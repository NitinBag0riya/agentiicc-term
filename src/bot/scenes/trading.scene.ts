/**
 * Trading Scene
 * Core trading interface: View Price, Place Orders, Manage Positions
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

interface TradingState {
  symbol: string;
  side?: 'BUY' | 'SELL'; // LONG/SHORT
  leverage?: number;
  size?: number; // Size in USD
  mode?: 'MARKET' | 'LIMIT';
}

export const tradingScene = new Scenes.BaseScene<BotContext>('trading');

tradingScene.enter(async (ctx) => {
  const state = ctx.scene.state as TradingState;
  
  if (!state.symbol) {
    await ctx.reply('⚠️ No symbol provided.');
    return ctx.scene.enter('citadel');
  }

  await refreshTradingView(ctx);
});

async function refreshTradingView(ctx: BotContext) {
  const state = ctx.scene.state as TradingState;
  const { symbol } = state;
  const userId = ctx.session.userId!;
  const exchange = ctx.session.activeExchange!;

  try {
    const message = await ctx.reply('⏳ Loading market data...');

    // 1. Get Market Price
    const ticker = await UniversalApiService.getMarketPrice(exchange, symbol);
    const price = parseFloat(ticker.price);
    const change24h = parseFloat(ticker.change24h);
    const changeSign = change24h >= 0 ? '+' : '';

    // 2. Get Open Positions to check if we have one for this symbol
    const positions = await UniversalApiService.getPositions(userId, exchange);
    const activePosition = positions.find(p => p.symbol === symbol);

    let displayMessage = '';
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
          Markup.button.callback('📉 Close Position', `close_${symbol}`),
          Markup.button.callback('➕ Add Size', 'add_size_placeholder') // Module 3
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
        [Markup.button.callback('🔄 Refresh', 'refresh')],
        [Markup.button.callback('🔙 Back', 'back_to_citadel')]
      ]);
    }

    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      message.message_id,
      undefined,
      displayMessage,
      { parse_mode: 'Markdown', ...keyboard }
    );

  } catch (error: any) {
    console.error('Trading View Error:', error);
    await ctx.reply(`❌ Failed to load market data: ${error.message}`);
    await ctx.scene.enter('citadel');
  }
}

// Actions
tradingScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery();
  await refreshTradingView(ctx);
});

tradingScene.action('back_to_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('citadel');
});

// Close Position
tradingScene.action(/close_(.+)/, async (ctx) => {
  const symbol = ctx.match[1];
  const userId = ctx.session.userId!;
  const exchange = ctx.session.activeExchange!;
  
  await ctx.answerCbQuery();
  await ctx.reply(`⚠️ Closing position for ${symbol}...`);
  
  try {
    const result = await UniversalApiService.closePosition(userId, exchange, symbol);
    await ctx.reply(`✅ Closed ${symbol} position.\nOrderId: \`${result.orderId}\``, { parse_mode: 'Markdown' });
    
    // Refresh view
    await refreshTradingView(ctx);
  } catch (error: any) {
    await ctx.reply(`❌ Failed to close position: ${error.message}`);
  }
});

// Place Trade Order (Simple Wizard for Amount)
// For now, hardcode amount or ask simple question.
// Given keeping it simple for Module 2:
// Just ask for amount in text? 
// DFD says: Click Long -> Click Amount Buttons or Type Amount.
// Let's implement a simple sub-scene or steps here?
// Can't easily mix wizard steps in BaseScene. 
// Let's us enter a wizard scene for placing order.
// We'll create `trading_order` wizard scene separately or use steps in trading scene?
// Trading Scene is defined as BaseScene here...
// Let's implement simple "Enter Amount" flow using session state since we are in a BaseScene.

tradingScene.action(['trade_long', 'trade_short'], async (ctx) => {
  // @ts-ignore
  const action = ctx.match[0] || ctx.match?.input; // Telegraf types quirk
  // Better way to get match from CallbackQuery
  const cb = ctx.callbackQuery as any;
  const data = cb.data;
  
  const side = data === 'trade_long' ? 'BUY' : 'SELL';
  (ctx.scene.state as TradingState).side = side;
  
  // Ask for size
  await ctx.reply(
    `💰 **Enter Position Size (USD)**
    
Type the amount you want to trade (e.g., 50, 100, 1000)
Or /cancel to abort.`,
    { parse_mode: 'Markdown' }
  );
  
  // We need to know we are waiting for amount.
  // BaseScene doesn't have "steps", so we check message text handler.
  (ctx.scene.state as TradingState).mode = 'MARKET'; // Default for Module 2
});

tradingScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const state = ctx.scene.state as TradingState;
  
  if (text === '/cancel') {
    await ctx.reply('Cancelled.');
    return refreshTradingView(ctx);
  }
  
  if (!state.side) {
    // Maybe search string if not placing order? 
    // DFD says search works in Citadel. In Trading, maybe ignore or navigate?
    // Let's ignore for now if not in order flow.
    return;
  }
  
  // Parse amount
  const amount = parseFloat(text);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Invalid amount. Please enter a number (e.g., 50).');
    return;
  }
  
  // Place Order
  try {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    
    await ctx.reply(`🚀 Placing ${state.side} order for $${amount}...`);
    
    // Calculate quantity based on price?
    // Universal API placeOrder usually takes quantity in base asset or quote asset?
    // Base Adapter says `quantity: string`. Usually base asset.
    // We need price to convert USD to Base Asset.
    const ticker = await UniversalApiService.getMarketPrice(exchange, state.symbol);
    const price = parseFloat(ticker.price);
    const quantity = (amount / price).toFixed(6); // Simple estimation
    
    const result = await UniversalApiService.placeOrder(userId, exchange, {
      symbol: state.symbol,
      side: state.side!,
      type: 'MARKET',
      quantity: quantity,
      // User might need to set leverage first? 
      // Default to cross/20x or whatever exchange default is if not set.
    });
    
    await ctx.reply(
      `✅ **Order Placed!**
      
Symbol: ${state.symbol}
Side: ${state.side}
Size: ${quantity} ${state.symbol} (~$${amount})
Status: ${result.status}`,
      { parse_mode: 'Markdown' }
    );
    
    // Reset state and refresh
    delete state.side;
    await refreshTradingView(ctx);
    
  } catch (error: any) {
    await ctx.reply(`❌ Order failed: ${error.message}`);
    delete state.side; // Reset so they can try again or cancel
  }
});
