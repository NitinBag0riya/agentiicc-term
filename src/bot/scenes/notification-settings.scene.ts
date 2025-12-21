import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const notificationSettingsScene = new Scenes.BaseScene<BotContext>('notification_settings');

// Screen: Notification Settings
notificationSettingsScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔔 Notification Settings',
    '',
    'Configure your alerts:',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📊 Trade Notifications',
    '• Order filled: ✅ ON',
    '• Order cancelled: ✅ ON',
    '• Position closed: ✅ ON',
    '',
    '💰 Price Alerts',
    '• Price alerts: ❌ OFF',
    '• TP/SL triggered: ✅ ON',
    '',
    '📈 Market Updates',
    '• Daily summary: ❌ OFF',
    '',
    '💡 Toggle settings below'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Trade Alerts', 'toggle_trade'),
        Markup.button.callback('💰 Price Alerts', 'toggle_price'),
      ],
      [
        Markup.button.callback('📈 Market Updates', 'toggle_market'),
      ],
      [
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

notificationSettingsScene.action('toggle_trade', async (ctx) => {
  await ctx.answerCbQuery('Trade alerts toggled!');
  await ctx.scene.reenter();
});

notificationSettingsScene.action('toggle_price', async (ctx) => {
  await ctx.answerCbQuery('Price alerts toggled!');
  await ctx.scene.reenter();
});

notificationSettingsScene.action('toggle_market', async (ctx) => {
  await ctx.answerCbQuery('Market updates toggled!');
  await ctx.scene.reenter();
});

notificationSettingsScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings_universal');
});

export default notificationSettingsScene;
