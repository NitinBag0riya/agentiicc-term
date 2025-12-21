import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const orderSuccessScene = new Scenes.BaseScene<BotContext>('order_success');

// Enter handler - Screen 32: Order Success
orderSuccessScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  const amount = ctx.session.orderAmount || 50;
  const orderId = ctx.session.lastOrderId || 'N/A';
  
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  
  const message = `┌─────────────────────────────┐
│ ✅ Order Executed!          │
│                             │
│ Your ${side} order has been │
│ successfully placed!        │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Symbol: ${symbol}            │
│ Side: ${side} ${sideEmoji}              │
│ Amount: $${amount}             │
│ Order ID: ${orderId}         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💡 Go to position to manage │
│    TP/SL and more           │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 View Position', 'view_position'),
        Markup.button.callback('🏰 Citadel', 'citadel'),
      ],
      [
        Markup.button.callback('💰 Trade Again', 'trade_again'),
      ],
    ]),
  });
});

orderSuccessScene.action('view_position', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_with_open');
});

orderSuccessScene.action('citadel', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

orderSuccessScene.action('trade_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default orderSuccessScene;
