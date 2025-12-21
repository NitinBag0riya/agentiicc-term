import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmConnectHyperliquidScene = new Scenes.BaseScene<BotContext>('confirm_connect_hyperliquid');

// Enter handler - Screen 14b: Confirm Connect Hyperliquid
confirmConnectHyperliquidScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔗 Connect Hyperliquid',
    '',
    'You are about to connect',
    'Hyperliquid exchange.',
    '',
    '🔸 High-leverage trading',
    '🔸 BTC/ETH focused',
    '🔸 Fast execution',
    '',
    'This will require:',
    '• API Key or WalletConnect',
    '• Trading permissions',
    '• Read account balance',
    '',
    '💡 Your credentials are',
    '   encrypted and secure'
  ];

  const message = createBox('Connect Hyperliquid', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔗 Connect', 'connect'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

confirmConnectHyperliquidScene.action('connect', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_hyperliquid');
});

confirmConnectHyperliquidScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default confirmConnectHyperliquidScene;
