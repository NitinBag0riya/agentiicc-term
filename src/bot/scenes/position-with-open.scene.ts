import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const positionWithOpenScene = new Scenes.BaseScene<BotContext>('position_with_open');

// Enter handler - Screen 24: Position With Open
positionWithOpenScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  // Default values
  let positionValue = '$0.00';
  let positionQty = '0.00';
  let entryPrice = '$0.00';
  let side = 'LONG';
  let sideEmoji = '🟢';
  let pnl = '+$0.00 (+0.00%)';
  let markPrice = '$0.00';
  let tpPrice = 'Not set';
  let slPrice = 'Not set';
  let openOrders: any[] = [];
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      // Get position data
      const positions = await UniversalApiService.getPositions(uid, exchange);
      const position = positions?.find((p: any) => p.symbol === symbol);
      
      if (position) {
        // @ts-ignore
        const p = position as any;
        const qty = parseFloat(p.size || p.positionAmt);
        side = qty > 0 ? 'LONG' : 'SHORT';
        sideEmoji = qty > 0 ? '🟢' : '🔴';
        positionQty = Math.abs(qty).toFixed(2);
        
        const mark = parseFloat(p.markPrice);
        const notional = Math.abs(qty) * mark;
        positionValue = `$${notional.toFixed(2)}`;
        entryPrice = `$${parseFloat(p.entryPrice).toFixed(2)}`;
        markPrice = `$${mark.toFixed(2)}`;
        
        const pnlValue = parseFloat(p.unrealizedPnl || p.unRealizedProfit);
        // Estimate margin if not provided
        const margin = parseFloat(p.margin) || (notional / parseFloat(p.leverage || '1'));
        const pnlPct = ((pnlValue / (margin || 1)) * 100).toFixed(2);
        pnl = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlValue >= 0 ? '+' : ''}${pnlPct}%)`;
      }
      
      // Get open orders
      const orders = await UniversalApiService.getOpenOrders(uid, exchange, symbol);
      if (orders) {
        openOrders = orders.slice(0, 3);
      }
    }
  } catch (error) {
    console.error('Error fetching position:', error);
  }
  
  const { createBox } = require('../utils/format');

  // Build orders display lines
  const ordersLines: string[] = [];
  if (openOrders.length > 0) {
    ordersLines.push('📋 Open Orders:');
    openOrders.forEach((o: any, i: number) => {
      ordersLines.push(`${i + 1}. ${o.side} ${o.type} [${o.timeInForce || 'GTC'}]`);
      ordersLines.push(`   ${o.quantity || o.origQty} @ $${o.price}`);
    });
  } else {
    ordersLines.push('📋 Open Orders: 0');
  }
  
  const lines = [
    `⚡ Manage ${symbol} Position`,
    '',
    `Current: ${positionValue}`,
    `(${positionQty} ${symbol.replace(/USDT$/, '')}) @ ${entryPrice}`,
    `${side} ${sideEmoji}`,
    '',
    `PnL: ${pnl}`,
    `Mark Price: ${markPrice}`,
    '',
    '---',
    '🎯 TP/SL Status',
    '',
    `TP: ${tpPrice}`,
    `SL: ${slPrice}`,
    '',
    '---',
    ...ordersLines
  ];

  const message = createBox('Position', lines, 34);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('➕ Increase', 'increase_position'),
        Markup.button.callback('➖ Decrease', 'decrease_position'),
        Markup.button.callback('❌ Close', 'close_position'),
      ],
      [
        Markup.button.callback('🎯 Set TP/SL', 'set_tpsl'),
        Markup.button.callback('📋 Orders', 'view_orders'),
      ],
      [
        Markup.button.callback('🔄 Refresh', 'refresh'),
        Markup.button.callback('🏰 Citadel', 'citadel'),
      ],
    ]),
  });
});

positionWithOpenScene.action('increase_position', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

positionWithOpenScene.action('decrease_position', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.isDecreasing = true;
  await ctx.scene.enter('position_no_open');
});

positionWithOpenScene.action('close_position', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('confirm_close_position');
});

positionWithOpenScene.action('set_tpsl', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('tpsl_setup');
});

positionWithOpenScene.action('view_orders', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('orders_list');
});

positionWithOpenScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

positionWithOpenScene.action('citadel', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default positionWithOpenScene;
