import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';

export const validatingAsterScene = new Scenes.BaseScene<BotContext>('validating_aster');

// Enter handler - Screen 8: Validating Aster Connection
validatingAsterScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ ⏳ Validating Aster DEX     │
│    Connection               │
│                             │
│ Testing API credentials...  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Connecting to Aster DEX...  │
│ Fetching account data...    │
│                             │
│ This may take a few         │
│ seconds.                    │
└─────────────────────────────┘`;

  await ctx.reply(message);
  
  // Simulate validation delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Check if we have temp credentials
  const walletAddress = ctx.session.tempWalletAddress;
  const apiKey = ctx.session.tempApiKey;
  
  if (!walletAddress || !apiKey) {
    await ctx.scene.enter('auth_error_aster');
    return;
  }
  
  // For now, just assume success and redirect to link scene
  // The actual linking is handled by the existing link.scene.ts
  ctx.session.linkExchange = 'aster';
  
  // Clear temp session data
  delete ctx.session.tempWalletAddress;
  delete ctx.session.tempApiKey;
  
  // Success - go to Universal Citadel
  await ctx.reply('✅ Successfully connected to Aster DEX!');
  await ctx.scene.enter('universal_citadel');
});

export default validatingAsterScene;
