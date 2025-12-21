import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const exchangeSelectionHyperliquidScene = new Scenes.BaseScene<BotContext>('exchange_selection_hyperliquid');

// Enter handler - Display Exchange Selection Hyperliquid (Screen 3)
exchangeSelectionHyperliquidScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔗 Link Hyperliquid',
    '',
    'Choose connection method:',
    '',
    '🔐 WalletConnect',
    '  (Recommended)',
    '  One-click connection',
    '  via your wallet',
    '',
    '🔗 API Key',
    '  Manual setup from',
    '  Hyperliquid dashboard',
    '',
    '🔒 Your credentials are',
    '   encrypted and stored',
    '   securely'
  ];

  const message = createBox('Hyperliquid', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔐 WalletConnect', 'wallet_connect_hyperliquid'),
        Markup.button.callback('🔗 API Key', 'api_key_hyperliquid'),
        Markup.button.callback('🔙 Back', 'back_to_welcome'),
      ],
    ]),
  });
});

// CTA 1: WalletConnect → Screen 6 (Mini App Auth Hyperliquid)
exchangeSelectionHyperliquidScene.action('wallet_connect_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('mini_app_auth_hyperliquid');
});

// CTA 2: API Key → Screen 7 (Link Wizard Hyperliquid)
exchangeSelectionHyperliquidScene.action('api_key_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_hyperliquid_step1');
});

// CTA 3: Back → Screen 1 (Welcome)
exchangeSelectionHyperliquidScene.action('back_to_welcome', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('welcome');
});

export default exchangeSelectionHyperliquidScene;
