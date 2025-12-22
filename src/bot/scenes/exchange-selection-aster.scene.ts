import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const exchangeSelectionAsterScene = new Scenes.BaseScene<BotContext>('exchange_selection_aster');

// Enter handler - Display Exchange Selection Aster (Screen 2)
exchangeSelectionAsterScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔗 Link Aster DEX',
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
    '  Aster DEX dashboard',
    '',
    '🔒 Your credentials are',
    '   encrypted and stored',
    '   securely'
  ];

  const message = createBox('Aster DEX', lines, 32);

  const webAppUrl = process.env.WEBAPP_URL
      ? `${process.env.WEBAPP_URL}/webapp/index.html`
      : 'https://agentifi.com/webapp/index.html'; // Fallback

  await ctx.reply('```\\n' + message + '\\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.webApp('🔐 WalletConnect', webAppUrl),
        Markup.button.callback('🔗 API Key', 'api_key_aster'),
        Markup.button.callback('🔙 Back', 'back_to_welcome'),
      ],
    ]),
  });
});

// CTA 1: WalletConnect - Handled by WebApp
// exchangeSelectionAsterScene.action('wallet_connect_aster') -> Removed as WebApp button opens directly

// CTA 2: API Key → Screen 5 (Link Wizard Aster)
exchangeSelectionAsterScene.action('api_key_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_aster_step1');
});

// CTA 3: Back → Screen 1 (Welcome)
exchangeSelectionAsterScene.action('back_to_welcome', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('welcome');
});

export default exchangeSelectionAsterScene;
