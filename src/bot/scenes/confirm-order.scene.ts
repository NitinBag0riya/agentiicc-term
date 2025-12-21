import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmOrderScene = new Scenes.BaseScene<BotContext>('confirm_order');

// Enter handler - Screen 30: Confirm Order
confirmOrderScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  const amount = ctx.session.orderAmount || 50;
  const orderType = ctx.session.orderType || 'Market';
  const leverage = ctx.session.leverage || 10;
  const marginMode = ctx.session.marginMode || 'Cross';
  
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  const sideText = side === 'LONG' ? 'Buy' : 'Sell';
  
  const message = `┌─────────────────────────────┐
│ ✅ Confirm Order            │
│                             │
│ You are about to ${sideText.toLowerCase()}:      │
│                             │
│ Symbol: ${symbol}            │
│ Side: ${side} ${sideEmoji}              │
│ Amount: $${amount}             │
│ Type: ${orderType}              │
│ Leverage: ${leverage}x             │
│ Margin: ${marginMode}             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ ⚠️  This is a real trade!   │
│ Please confirm your order.  │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`✅ ${sideText} ${side}`, 'execute_order'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

confirmOrderScene.action('execute_order', async (ctx) => {
  await ctx.answerCbQuery('Executing order...');
  await ctx.scene.enter('order_executing');
});

confirmOrderScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default confirmOrderScene;
