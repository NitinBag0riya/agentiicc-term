import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const orderExecutingScene = new Scenes.BaseScene<BotContext>('order_executing');

// Enter handler - Screen 31: Order Executing
orderExecutingScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  const amount = ctx.session.orderAmount || 50;
  const orderType = ctx.session.orderType || 'Market';
  const leverage = ctx.session.leverage || 10;
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  const message = `┌─────────────────────────────┐
│ ⏳ Executing Order          │
│                             │
│ Placing ${side} order...    │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Symbol: ${symbol}            │
│ Amount: $${amount}             │
│                             │
│ Please wait...              │
└─────────────────────────────┘`;

  await ctx.reply(message);
  
  try {
    if (userId) {
      const orderSide = side === 'LONG' ? 'BUY' : 'SELL';
      
      const result = await UniversalApiService.placeOrder(userId, exchange, {
        symbol,
        side: orderSide,
        type: orderType.toUpperCase(),
        quoteOrderQty: amount,
        leverage,
      });
      
      if (result && result.orderId) {
        ctx.session.lastOrderId = result.orderId;
        ctx.session.lastOrderResult = result;
        await ctx.scene.enter('order_success');
      } else {
        throw new Error('Order failed - no order ID returned');
      }
    }
  } catch (error: any) {
    console.error('Order execution error:', error);
    ctx.session.lastOrderError = error.message || 'Unknown error occurred';
    await ctx.scene.enter('order_error');
  }
});

export default orderExecutingScene;
