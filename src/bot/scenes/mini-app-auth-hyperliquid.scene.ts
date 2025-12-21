import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const miniAppAuthHyperliquidScene = new Scenes.BaseScene<BotContext>('mini_app_auth_hyperliquid');

// Enter handler - Display Mini App Auth Hyperliquid (Screen 6)
miniAppAuthHyperliquidScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔐 Connect to Hyperliquid  │
│                             │
│ Connecting your wallet to   │
│ Hyperliquid...              │
│                             │
│ 📱 Please approve the       │
│    connection in your       │
│    wallet app               │
│                             │
│ 🔗 Required Permissions:    │
│ • View account balance      │
│ • Place trades              │
│ • View positions            │
│                             │
│ ⏳ Waiting for approval...  │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Refresh Status', 'refresh_status'),
        Markup.button.callback('❌ Cancel', 'cancel_auth'),
      ],
    ]),
  });
});

// CTA 1: Refresh → Screen 6 (Self)
miniAppAuthHyperliquidScene.action('refresh_status', async (ctx) => {
  await ctx.answerCbQuery('Checking connection status...');
  // TODO: Check wallet connection status
  // If connected: await ctx.scene.enter('validating_hyperliquid');
  await ctx.scene.reenter();
});

// CTA 2: Cancel → Screen 3 (Exchange Selection Hyperliquid)
miniAppAuthHyperliquidScene.action('cancel_auth', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_hyperliquid');
});

export default miniAppAuthHyperliquidScene;
