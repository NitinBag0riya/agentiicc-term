import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const settingsNewScene = new Scenes.BaseScene<BotContext>('settings_new');

// Enter handler - Screen 48: Settings
settingsNewScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'both';
  
  const message = `┌─────────────────────────────┐
│ ⚙️ Settings                 │
│                             │
│ 📊 Account Status           │
│ Linked Exchanges: 2         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 🔗 Exchange Links           │
│ • Aster DEX: ✅ Linked      │
│ • Hyperliquid: ✅ Linked    │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 🔔 Notifications            │
│ • Trade alerts: ON          │
│ • Price alerts: OFF         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💡 Manage your exchanges    │
│    and preferences below    │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔗 Link Exchange', 'link_exchange'),
        Markup.button.callback('🔓 Unlink Exchange', 'unlink_exchange'),
      ],
      [
        Markup.button.callback('🔔 Notifications', 'notifications'),
        Markup.button.callback('❓ Help', 'help'),
      ],
      [
        Markup.button.callback('🏰 Back to Citadel', 'back_citadel'),
      ],
    ]),
  });
});

settingsNewScene.action('link_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('welcome');
});

settingsNewScene.action('unlink_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('unlink');
});

settingsNewScene.action('notifications', async (ctx) => {
  await ctx.answerCbQuery('Notification settings coming soon!');
});

settingsNewScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

settingsNewScene.action('back_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default settingsNewScene;
