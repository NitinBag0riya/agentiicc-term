import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const settingsUniversalScene = new Scenes.BaseScene<BotContext>('settings_universal');

// Enter handler - Screen 53: Universal Settings
settingsUniversalScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ ⚙️ Universal Settings       │
│                             │
│ 📊 Connected Exchanges      │
│                             │
│ ✅ Aster DEX                │
│   • Linked                  │
│   • Trading enabled         │
│                             │
│ ✅ Hyperliquid              │
│   • Linked                  │
│   • Trading enabled         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 🔗 Manage Exchanges         │
│ 🔔 Notifications            │
│ 🔒 Security Settings        │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔗 Link Exchange', 'link'),
        Markup.button.callback('🔓 Unlink Exchange', 'unlink'),
      ],
      [
        Markup.button.callback('⚙️ Aster Settings', 'settings_aster'),
        Markup.button.callback('⚙️ Hyperliquid Settings', 'settings_hyperliquid'),
      ],
      [
        Markup.button.callback('🏰 Back', 'back'),
      ],
    ]),
  });
});

settingsUniversalScene.action('link', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('welcome');
});

settingsUniversalScene.action('unlink', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('unlink');
});

settingsUniversalScene.action('settings_aster', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('settings');
});

settingsUniversalScene.action('settings_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('settings');
});

settingsUniversalScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default settingsUniversalScene;
