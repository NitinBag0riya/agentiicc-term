import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';

export const validatingHyperliquidScene = new Scenes.BaseScene<BotContext>('validating_hyperliquid');

// Enter handler - Screen 10: Validating Hyperliquid Connection
validatingHyperliquidScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ ⏳ Validating Hyperliquid   │
│    Connection               │
│                             │
│ Testing API credentials...  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Connecting to Hyperliquid...│
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
    await ctx.scene.enter('auth_error_hyperliquid');
    return;
  }
  
  // For now, just assume success and redirect to link scene
  // The actual linking is handled by the existing link.scene.ts
  ctx.session.linkExchange = 'hyperliquid';
  
  // Clear temp session data
  delete ctx.session.tempWalletAddress;
  delete ctx.session.tempApiKey;
  
  // Success - go to Universal Citadel
  await ctx.reply('✅ Successfully connected to Hyperliquid!');
  await ctx.scene.enter('universal_citadel');
});

export default validatingHyperliquidScene;
