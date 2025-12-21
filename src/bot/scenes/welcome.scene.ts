import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const welcomeScene = new Scenes.BaseScene<BotContext>('welcome');

// Enter handler - Display Welcome Screen (Screen 1)
welcomeScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│  👋 Welcome to StableSolid  │
│                             │
│ Your Easy Terminal into     │
│ Multi-Exchange Trading      │
│                             │
│ Choose Exchange to Connect: │
│                             │
│ 🔸 Aster DEX                │
│   Advanced trading features │
│   Spot & perpetual swaps    │
│                             │
│ 🔸 Hyperliquid              │
│   High-leverage trading     │
│   BTC/ETH focused           │
│                             │
│ 💡 Connect at least one     │
│    exchange to get started  │
│ 💡 You can add more later   │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔸 Aster DEX', 'select_aster'),
        Markup.button.callback('🔸 Hyperliquid', 'select_hyperliquid'),
        Markup.button.callback('❓ Help', 'show_help'),
      ],
    ]),
  });
});

// CTA 1: Aster DEX → Screen 2 (Exchange Selection Aster)
welcomeScene.action('select_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

// CTA 2: Hyperliquid → Screen 3 (Exchange Selection Hyperliquid)
welcomeScene.action('select_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_hyperliquid');
});

// CTA 3: Help → Screen 50 (Help)
welcomeScene.action('show_help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

export default welcomeScene;
