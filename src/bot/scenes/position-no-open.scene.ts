import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const positionNoOpenScene = new Scenes.BaseScene<BotContext>('position_no_open');

// Enter handler - Screen 19: Position - No Open Position
positionNoOpenScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  // Default values
  let price = '0.00';
  let change24h = '+0.00%';
  let changeValue = '+$0.00';
  let high24h = '$0.00';
  let low24h = '$0.00';
  let volume = '0.0M USDT';
  let openOrders = 0;
  const orderType = ctx.session.orderType || 'Market';
  const leverage = ctx.session.leverage || 10;
  const marginMode = ctx.session.marginMode || 'Cross';
  
  // Fetch market data
  try {
    if (userId) {
      const ticker = await UniversalApiService.getTicker(userId, exchange, symbol);
      if (ticker) {
        price = parseFloat(ticker.lastPrice).toFixed(2);
        const pctChange = parseFloat(ticker.priceChangePercent);
        change24h = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;
        const priceChange = parseFloat(ticker.lastPrice) - parseFloat(ticker.openPrice);
        changeValue = `(${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)})`;
        high24h = `$${parseFloat(ticker.highPrice).toFixed(2)}`;
        low24h = `$${parseFloat(ticker.lowPrice).toFixed(2)}`;
        volume = `${(parseFloat(ticker.quoteVolume) / 1000000).toFixed(1)}M USDT`;
      }
      
      // Get open orders count
      const orders = await UniversalApiService.getOrders(userId, exchange, symbol);
      openOrders = orders?.length || 0;
    }
  } catch (error) {
    console.error('Error fetching ticker:', error);
  }
  
  const message = `┌─────────────────────────────┐
│ ⚡ ${symbol} - New Position    │
│                             │
│ 📈 Price: $${price}           │
│ 24h Change: ${change24h}          │
│            ${changeValue}         │
│ 24h High/Low: ${high24h} /     │
│               ${low24h}       │
│ 24h Volume: ${volume}      │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📋 Open Orders: ${openOrders}           │
│                             │
│ ⚙️  Trading Settings        │
│ • Order Type: ${orderType}        │
│ • Leverage: ${leverage}x             │
│ • Margin: ${marginMode}             │
│                             │
│ Ready to open a position?   │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`🔄 ${orderType}`, 'toggle_order_type'),
        Markup.button.callback(`${leverage}x`, 'leverage_menu'),
        Markup.button.callback(`🔄 ${marginMode}`, 'toggle_margin'),
      ],
      [
        Markup.button.callback('Long $50', 'long_50'),
        Markup.button.callback('Long $200', 'long_200'),
        Markup.button.callback('Long X', 'long_custom'),
      ],
      [
        Markup.button.callback('Short $50', 'short_50'),
        Markup.button.callback('Short $200', 'short_200'),
        Markup.button.callback('Short X', 'short_custom'),
      ],
      [
        Markup.button.callback('🎯 Set TP/SL', 'set_tpsl'),
        Markup.button.callback('« Back', 'back'),
        Markup.button.callback('🔄 Refresh', 'refresh'),
      ],
    ]),
  });
});

positionNoOpenScene.action('toggle_order_type', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.orderType = ctx.session.orderType === 'Market' ? 'Limit' : 'Market';
  await ctx.scene.reenter();
});

positionNoOpenScene.action('leverage_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('leverage_menu');
});

positionNoOpenScene.action('toggle_margin', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.marginMode = ctx.session.marginMode === 'Cross' ? 'Isolated' : 'Cross';
  await ctx.scene.reenter();
});

positionNoOpenScene.action(/long_(50|200)/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.orderSide = 'LONG';
  ctx.session.orderAmount = parseInt(ctx.match[1]);
  await ctx.scene.enter('confirm_order');
});

positionNoOpenScene.action('long_custom', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.orderSide = 'LONG';
  await ctx.scene.enter('custom_amount');
});

positionNoOpenScene.action(/short_(50|200)/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.orderSide = 'SHORT';
  ctx.session.orderAmount = parseInt(ctx.match[1]);
  await ctx.scene.enter('confirm_order');
});

positionNoOpenScene.action('short_custom', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.orderSide = 'SHORT';
  await ctx.scene.enter('custom_amount');
});

positionNoOpenScene.action('set_tpsl', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('tpsl_setup');
});

positionNoOpenScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

positionNoOpenScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

export default positionNoOpenScene;
