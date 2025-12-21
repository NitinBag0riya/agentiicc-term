import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const authErrorHyperliquidScene = new Scenes.BaseScene<BotContext>('auth_error_hyperliquid');

// Enter handler - Screen 13: Auth Error Hyperliquid
authErrorHyperliquidScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '❌ Connection Failed',
    '',
    'Failed to connect to',
    'Hyperliquid.',
    '',
    'Possible issues:',
    '• Invalid API credentials',
    '• Network connection',
    '• Exchange maintenance',
    '',
    'Please check your API key',
    'and try again.',
    '',
    '💡 Need help? Contact',
    '   support@stablesolid.com'
  ];

  const message = createBox('Error', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Try Again', 'try_again'),
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

authErrorHyperliquidScene.action('try_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_hyperliquid_step1');
});

authErrorHyperliquidScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_hyperliquid');
});

authErrorHyperliquidScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default authErrorHyperliquidScene;
