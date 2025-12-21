import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const helpScene = new Scenes.BaseScene<BotContext>('help');

// Enter handler - Screen 50: Help
helpScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '❓ Help & Support',
    '',
    '📖 Getting Started:',
    '1. Connect an exchange',
    '2. View your portfolio',
    '3. Start trading!',
    '',
    '---',
    '',
    '🔸 Commands:',
    '/start - Show welcome',
    '/menu - Main menu',
    '/orders - View open orders',
    '/settings - Bot settings',
    '/help - This help screen',
    '',
    '---',
    '',
    '🔸 Quick Actions:',
    '• Type symbol (BTC, SOL)',
    '  to search and trade',
    '• Click positions to manage',
    '• Use buttons for nav',
    '',
    '---',
    '',
    '📧 Support:',
    'support@stablesolid.com',
    '',
    '🐦 Twitter: @StableSolid',
    '💬 Telegram: @StableSolidHQ'
  ];

  const message = createBox('Help', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🏰 Citadel', 'citadel'),
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('💰 Trade', 'trade'),
      ],
    ]),
  });
});

helpScene.action('citadel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

helpScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings');
});

helpScene.action('trade', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('search_prompt_universal');
});

export default helpScene;
