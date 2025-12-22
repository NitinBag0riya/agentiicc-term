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
  // Leverage defined later after sync
  const marginMode = ctx.session.marginMode || 'Cross';
  
  // Fetch market data
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      // Note: UniversalApiService might not expose getTicker explicitly if it's not static? 
      // Checking usage elsewhere, it seems we use it statically. If getTicker is missing, we use placeholder.
      // @ts-ignore
      const ticker = await UniversalApiService.getTicker(uid, exchange, symbol);
      
      if (ticker) {
        const lastPrice = parseFloat(ticker.lastPrice || ticker.price);
        price = lastPrice.toFixed(2);
        const openPrice = parseFloat(ticker.openPrice || (lastPrice * 0.99).toString()); // fallback
        const pctChange = parseFloat(ticker.priceChangePercent || '0');
        
        change24h = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`;
        const priceChange = lastPrice - openPrice;
        changeValue = `(${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)})`;
        high24h = `$${parseFloat(ticker.highPrice || ticker.high24h).toFixed(2)}`;
        low24h = `$${parseFloat(ticker.lowPrice || ticker.low24h).toFixed(2)}`;
        volume = `${(parseFloat(ticker.quoteVolume || ticker.volume24h) / 1000000).toFixed(1)}M USDT`;
      }
      
      // Get open orders count
      const orders = await UniversalApiService.getOpenOrders(uid, exchange, symbol);
      openOrders = orders?.length || 0;
      
      // Fetch current leverage from exchange to sync
      try {
        const leverageInfo = await UniversalApiService.getLeverage(uid, exchange, symbol);
        if (leverageInfo && leverageInfo.leverage) {
          ctx.session.leverage = leverageInfo.leverage;
          console.log(`[Leverage Sync] Fetched ${leverageInfo.leverage}x from ${exchange}`);
        }
      } catch (error) {
        console.error('Error fetching leverage:', error);
      }
    }
  } catch (error) {
    console.error('Error fetching ticker:', error);
  }
  
  // Use session leverage (now synced)
  const leverage = ctx.session.leverage || 10;
  
  const { createBox } = require('../utils/format');

  const lines = [
    `⚡ ${symbol} - New Position`,
    '',
    `📈 Price: $${price}`,
    `24h Change: ${change24h}`,
    `            ${changeValue}`,
    `24h High: ${high24h}`,
    `24h Low:  ${low24h}`,
    `24h Vol:  ${volume}`,
    '',
    '---',
    `📋 Open Orders: ${openOrders}`,
    '',
    '⚙️  Trading Settings',
    `• Order Type: ${orderType}`,
    `• Leverage: ${leverage}x`,
    `• Margin: ${marginMode}`,
    '',
    'Ready to open a position?'
  ];

  const message = createBox('Trade', lines, 34);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
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
