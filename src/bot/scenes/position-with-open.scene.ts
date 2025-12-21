import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../../services/universal-api.service';

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
      // Get position data
      const positions = await UniversalApiService.getPositions(userId, exchange);
      const position = positions?.find((p: any) => p.symbol === symbol);
      
      if (position) {
        const qty = parseFloat(position.positionAmt);
        side = qty > 0 ? 'LONG' : 'SHORT';
        sideEmoji = qty > 0 ? '🟢' : '🔴';
        positionQty = Math.abs(qty).toFixed(2);
        positionValue = `$${parseFloat(position.notional).toFixed(2)}`;
        entryPrice = `$${parseFloat(position.entryPrice).toFixed(2)}`;
        markPrice = `$${parseFloat(position.markPrice).toFixed(2)}`;
        
        const pnlValue = parseFloat(position.unRealizedProfit);
        const pnlPct = ((pnlValue / parseFloat(position.margin || '1')) * 100).toFixed(2);
        pnl = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlValue >= 0 ? '+' : ''}${pnlPct}%)`;
      }
      
      // Get open orders
      const orders = await UniversalApiService.getOrders(userId, exchange, symbol);
      if (orders) {
        openOrders = orders.slice(0, 3);
      }
    }
  } catch (error) {
    console.error('Error fetching position:', error);
  }
  
  // Build orders display
  let ordersText = '';
  if (openOrders.length > 0) {
    ordersText = openOrders.map((o: any, i: number) => {
      return `│ ${i + 1}. ${o.side} ${o.type} [${o.timeInForce}]     │
│    ${o.origQty} @ $${o.price}         │`;
    }).join('\n│                             │\n');
  } else {
    ordersText = '│ No open orders              │';
  }
  
  const message = `┌─────────────────────────────┐
│ ⚡ Manage ${symbol} Position   │
│                             │
│ Current: ${positionValue}          │
│ (${positionQty} ${symbol.replace(/USDT$/, '')}) @ ${entryPrice}       │
│ ${side} ${sideEmoji}                     │
│                             │
│ PnL: ${pnl}     │
│ Mark Price: ${markPrice}         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 🎯 TP/SL Status             │
│                             │
│ TP: ${tpPrice}              │
│ SL: ${slPrice}              │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📋 Open Orders (${openOrders.length})          │
│                             │
${ordersText}
└─────────────────────────────┘`;

  await ctx.reply(message, {
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
