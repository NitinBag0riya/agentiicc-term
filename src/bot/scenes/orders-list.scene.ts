import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const ordersListScene = new Scenes.BaseScene<BotContext>('orders_list');

// Enter handler - Screen 41: Orders List
ordersListScene.enter(async (ctx) => {
  // TODO: Fetch actual orders from API
  const symbol = ctx.session.tradingSymbol || 'All';
  const exchange = ctx.session.activeExchange || 'aster';
  
  const message = `┌─────────────────────────────┐
│ 📋 Open Orders              │
│                             │
│ Exchange: ${exchange.toUpperCase()}       │
│ Symbol: ${symbol}               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ No open orders              │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💡 Click an order to        │
│    view details or cancel   │
└─────────────────────────────┘`;

  await ctx.reply(message, {
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
