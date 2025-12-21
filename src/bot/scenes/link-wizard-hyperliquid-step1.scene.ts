import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const linkWizardHyperliquidStep1Scene = new Scenes.BaseScene<BotContext>('link_wizard_hyperliquid_step1');

// Enter handler - Screen 7: Hyperliquid API Setup Step 1
linkWizardHyperliquidStep1Scene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔗 Hyperliquid API Setup   │
│                             │
│ Step 1: Enter your wallet   │
│ address from Hyperliquid    │
│                             │
│ 📝 Format: 0x...           │
│                             │
│ 💡 Find this in:           │
│ Settings > API Keys >       │
│ Wallet Address              │
│                             │
│ 🔒 This will be encrypted   │
│    and stored securely      │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Type wallet address', 'type_address'),
        Markup.button.callback('🔙 Back', 'back'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  ctx.scene.session.state = { awaitingWalletAddress: true, exchange: 'hyperliquid' };
});

linkWizardHyperliquidStep1Scene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  if (state?.awaitingWalletAddress) {
    const walletAddress = ctx.message.text.trim();
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      await ctx.reply('❌ Invalid wallet address format. Please enter a valid Ethereum address (0x...)');
      return;
    }
    ctx.session.tempWalletAddress = walletAddress;
    await ctx.scene.enter('link_wizard_hyperliquid_step2');
  }
});

linkWizardHyperliquidStep1Scene.action('type_address', async (ctx) => {
  await ctx.answerCbQuery('Please type your wallet address below');
});

linkWizardHyperliquidStep1Scene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_hyperliquid');
});

linkWizardHyperliquidStep1Scene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default linkWizardHyperliquidStep1Scene;
