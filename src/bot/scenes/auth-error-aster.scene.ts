import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const authErrorAsterScene = new Scenes.BaseScene<BotContext>('auth_error_aster');

// Enter handler - Screen 12: Auth Error Aster
authErrorAsterScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ ❌ Connection Failed        │
│                             │
│ Failed to connect to        │
│ Aster DEX.                  │
│                             │
│ Possible issues:            │
│ • Invalid API credentials   │
│ • Network connection        │
│ • Exchange maintenance      │
│                             │
│ Please check your API key   │
│ and try again.              │
│                             │
│ 💡 Need help? Contact       │
│    support@stablesolid.com  │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Try Again', 'try_again'),
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

authErrorAsterScene.action('try_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_aster_step1');
});

authErrorAsterScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

authErrorAsterScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default authErrorAsterScene;
