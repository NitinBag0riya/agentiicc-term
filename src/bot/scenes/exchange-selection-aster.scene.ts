import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const exchangeSelectionAsterScene = new Scenes.BaseScene<BotContext>('exchange_selection_aster');

// Enter handler - Display Exchange Selection Aster (Screen 2)
exchangeSelectionAsterScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔗 Link Aster DEX           │
│                             │
│ Choose connection method:   │
│                             │
│ 🔐 WalletConnect            │
│   (Recommended)             │
│   One-click connection      │
│   via your wallet           │
│                             │
│ 🔗 API Key                  │
│   Manual setup from         │
│   Aster DEX dashboard       │
│                             │
│ 🔒 Your credentials are     │
│    encrypted and stored     │
│    securely                 │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔐 WalletConnect', 'wallet_connect_aster'),
        Markup.button.callback('🔗 API Key', 'api_key_aster'),
        Markup.button.callback('🔙 Back', 'back_to_welcome'),
      ],
    ]),
  });
});

// CTA 1: WalletConnect → Screen 4 (Mini App Auth Aster)
exchangeSelectionAsterScene.action('wallet_connect_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('mini_app_auth_aster');
});

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
