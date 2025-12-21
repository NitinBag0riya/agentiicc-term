import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const orderErrorScene = new Scenes.BaseScene<BotContext>('order_error');

// Enter handler - Screen 33: Order Error
orderErrorScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const errorMessage = ctx.session.lastOrderError || 'Unknown error occurred';
  
  const message = `┌─────────────────────────────┐
│ ❌ Order Failed             │
│                             │
│ Failed to execute order     │
│ for ${symbol}               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Error: ${errorMessage.slice(0, 50)}  │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Possible issues:            │
│ • Insufficient balance      │
│ • Invalid leverage          │
│ • Market closed             │
│ • API error                 │
│                             │
│ 💡 Please try again or      │
│    contact support          │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Try Again', 'try_again'),
        Markup.button.callback('🏰 Citadel', 'citadel'),
      ],
    ]),
  });
});

orderErrorScene.action('try_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

orderErrorScene.action('citadel', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default orderErrorScene;
