import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const linkWizardAsterStep1Scene = new Scenes.BaseScene<BotContext>('link_wizard_aster_step1');

// Enter handler - Display Link Wizard Aster Step 1 (Screen 5)
linkWizardAsterStep1Scene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔗 Aster DEX API Setup     │
│                             │
│ Step 1: Enter your wallet   │
│ address from Aster DEX      │
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
        Markup.button.callback('Type address', 'type_address'),
        Markup.button.callback('🔙 Back', 'back'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  // Set scene state to expect wallet address input
  ctx.scene.session.state = { awaitingWalletAddress: true, exchange: 'aster' };
});

// Handle text input for wallet address
linkWizardAsterStep1Scene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  
  if (state?.awaitingWalletAddress) {
    const walletAddress = ctx.message.text.trim();
    
    // Basic validation
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      await ctx.reply('❌ Invalid wallet address format. Please enter a valid Ethereum address (0x...)');
      return;
    }
    
    // Store wallet address in session
    ctx.session.tempWalletAddress = walletAddress;
    
    // Navigate to Step 2
    await ctx.scene.enter('link_wizard_aster_step2');
  }
});

// CTA 1: Type address (just a prompt, actual input handled by text handler)
linkWizardAsterStep1Scene.action('type_address', async (ctx) => {
  await ctx.answerCbQuery('Please type your wallet address below');
});

// CTA 2: Back → Screen 2 (Exchange Selection Aster)
linkWizardAsterStep1Scene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

// CTA 3: Cancel → Screen 15 (Universal Citadel)
linkWizardAsterStep1Scene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default linkWizardAsterStep1Scene;
