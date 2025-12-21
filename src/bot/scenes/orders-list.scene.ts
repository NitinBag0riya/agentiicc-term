import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const ordersListScene = new Scenes.BaseScene<BotContext>('orders_list');

// Enter handler - Screen 41: Orders List
ordersListScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const symbol = ctx.session.tradingSymbol; // If undefined, fetches all
  const userId = ctx.from?.id?.toString();
  
  const { createBox } = require('../utils/format');
  const { UniversalApiService } = require('../services/universal-api.service');
  
  let orderLines: string[] = [];
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      const orders = await UniversalApiService.getOpenOrders(uid, exchange, symbol === 'All' ? undefined : symbol);
      
      if (orders && orders.length > 0) {
        orders.forEach((o: any) => {
            const sideEmoji = o.side === 'BUY' ? '🟢' : '🔴';
            // "🟢 BUY BTCUSDT $95000 (0.1)"
            orderLines.push(`${sideEmoji} ${o.side} ${o.symbol}`);
            orderLines.push(`   Price: ${o.price} | Qty: ${o.quantity}`);
            orderLines.push('');
        });
        // Limit display
        if (orderLines.length > 15) {
            orderLines = orderLines.slice(0, 15);
            orderLines.push('...and more');
        }
      } else {
        orderLines.push('No open orders');
      }
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    orderLines.push('Error fetching orders');
  }

  const lines = [
    '📋 Open Orders',
    '',
    `Exchange: ${exchange.toUpperCase()}`,
    `Filter: ${symbol || 'All'}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    ...orderLines,
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '💡 Click Cancel All to',
    '   remove all orders'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('❌ Cancel All', 'cancel_all'),
        Markup.button.callback('🔄 Refresh', 'refresh'),
      ],
      [
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

ordersListScene.action('cancel_all', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('confirm_cancel_all');
});

ordersListScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

ordersListScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.session.tradingSymbol) {
    await ctx.scene.enter('position_with_open');
  } else {
    const exchange = ctx.session.activeExchange || 'aster';
    await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
  }
});

export default ordersListScene;
