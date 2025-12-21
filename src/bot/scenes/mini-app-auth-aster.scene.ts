import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const miniAppAuthAsterScene = new Scenes.BaseScene<BotContext>('mini_app_auth_aster');

// Enter handler - Display Mini App Auth Aster (Screen 4)
miniAppAuthAsterScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔐 Connect to Aster DEX',
    '',
    'Connecting your wallet to',
    'Aster DEX...',
    '',
    '📱 Please approve the',
    '   connection in your',
    '   wallet app',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🔗 Required Permissions:',
    '• View account balance',
    '• Place trades',
    '• View positions',
    '',
    '⏳ Waiting for approval...'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Refresh Status', 'refresh_status'),
        Markup.button.callback('❌ Cancel', 'cancel_auth'),
      ],
    ]),
  });
});

// CTA 1: Refresh → Screen 4 (Self)
miniAppAuthAsterScene.action('refresh_status', async (ctx) => {
  await ctx.answerCbQuery('Checking connection status...');
  // TODO: Check wallet connection status
  // If connected: await ctx.scene.enter('validating_aster');
  // For now, just refresh the screen
  await ctx.scene.reenter();
});

// CTA 2: Cancel → Screen 2 (Exchange Selection Aster)
miniAppAuthAsterScene.action('cancel_auth', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

export default miniAppAuthAsterScene;
