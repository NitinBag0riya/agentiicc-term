import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmClosePositionScene = new Scenes.BaseScene<BotContext>('confirm_close_position');

// Enter handler - Screen: Confirm Close Position
confirmClosePositionScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'UNKNOWN';
  
  const message = `┌─────────────────────────────┐
│ ⚠️ Close Position?          │
│                             │
│ You are about to close your │
│ ${symbol} position.          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ This will:                  │
│ • Close your entire position│
│ • Execute at market price   │
│ • Cancel related TP/SL      │
│                             │
│ ⚠️ This cannot be undone!   │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, Close', 'confirm_close'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

confirmClosePositionScene.action('confirm_close', async (ctx) => {
  await ctx.answerCbQuery('Closing position...');
  // TODO: Execute close position via API
  await ctx.reply('✅ Position closed successfully!');
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

confirmClosePositionScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_with_open');
});

export default confirmClosePositionScene;
