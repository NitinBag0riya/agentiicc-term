import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const leverageMenuScene = new Scenes.BaseScene<BotContext>('leverage_menu');

// Enter handler - Screen 35: Leverage Menu
leverageMenuScene.enter(async (ctx) => {
  const currentLeverage = ctx.session.leverage || 10;
  
  const message = `┌─────────────────────────────┐
│ 📊 Set Leverage             │
│                             │
│ Current: ${currentLeverage}x               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Select leverage:            │
│                             │
│ ⚠️  Higher leverage =       │
│    higher risk              │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('1x', 'lev_1'),
        Markup.button.callback('2x', 'lev_2'),
        Markup.button.callback('5x', 'lev_5'),
      ],
      [
        Markup.button.callback('10x', 'lev_10'),
        Markup.button.callback('20x', 'lev_20'),
        Markup.button.callback('25x', 'lev_25'),
      ],
      [
        Markup.button.callback('50x', 'lev_50'),
        Markup.button.callback('75x', 'lev_75'),
        Markup.button.callback('100x', 'lev_100'),
      ],
      [
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

leverageMenuScene.action(/lev_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.leverage = parseInt(ctx.match[1]);
  await ctx.scene.enter('position_no_open');
});

leverageMenuScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default leverageMenuScene;
