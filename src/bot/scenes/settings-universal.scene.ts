import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const settingsUniversalScene = new Scenes.BaseScene<BotContext>('settings_universal');

// Enter handler - Screen 53: Universal Settings
settingsUniversalScene.enter(async (ctx) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const { createBox } = require('../utils/format');
  const { getOrCreateUser, getLinkedExchanges } = require('../../db/users');

  let asterLinked = false;
  let hyperliquidLinked = false;

  try {
     if (telegramId) {
        const user = await getOrCreateUser(telegramId, username);
        if (user && user.id) {
           const linked = await getLinkedExchanges(user.id);
           asterLinked = linked.includes('aster');
           hyperliquidLinked = linked.includes('hyperliquid');
        }
     }
  } catch (e) {
     console.error('Settings load error:', e);
  }

  const lines = [
    '📊 Connected Exchanges',
    '',
    asterLinked ? '✅ Aster DEX' : '❌ Aster DEX',
    asterLinked ? '  • Linked' : '  • Not Linked',
    asterLinked ? '  • Trading enabled' : '  • Tap Link to connect',
    '',
    hyperliquidLinked ? '✅ Hyperliquid' : '❌ Hyperliquid',
    hyperliquidLinked ? '  • Linked' : '  • Not Linked',
    hyperliquidLinked ? '  • Trading enabled' : '  • Tap Link to connect',
    '',
    '🔗 Manage Exchanges',
    '🔔 Notifications',
    '🔒 Security Settings'
  ];

  const message = createBox('Universal Settings', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
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
