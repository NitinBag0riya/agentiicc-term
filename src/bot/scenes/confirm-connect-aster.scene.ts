import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmConnectAsterScene = new Scenes.BaseScene<BotContext>('confirm_connect_aster');

// Enter handler - Screen 14: Confirm Connect Aster
confirmConnectAsterScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔗 Connect Aster DEX        │
│                             │
│ You are about to connect    │
│ Aster DEX exchange.         │
│                             │
│ 🔸 Advanced trading features│
│ 🔸 Spot & perpetual swaps   │
│ 🔸 Competitive fees         │
│                             │
│ This will require:          │
│ • API Key or WalletConnect  │
│ • Trading permissions       │
│ • Read account balance      │
│                             │
│ 💡 Your credentials are     │
│    encrypted and secure     │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔗 Connect', 'connect'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

confirmConnectAsterScene.action('connect', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

confirmConnectAsterScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default confirmConnectAsterScene;
