import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ExchangeCredentialService } from '../../services/exchange-credential.service';

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
  
  // Attempt to validate credentials
  try {
    const walletAddress = ctx.session.tempWalletAddress;
    const apiKey = ctx.session.tempApiKey;
    const userId = ctx.from?.id?.toString();
    
    if (!userId || !walletAddress || !apiKey) {
      await ctx.scene.enter('auth_error_hyperliquid');
      return;
    }
    
    // Save and validate credentials
    await ExchangeCredentialService.saveCredentials(userId, 'hyperliquid', {
      walletAddress,
      apiKey,
    });
    
    // Clear temp session data
    delete ctx.session.tempWalletAddress;
    delete ctx.session.tempApiKey;
    
    // Success - go to Universal Citadel
    await ctx.reply('✅ Successfully connected to Hyperliquid!');
    await ctx.scene.enter('universal_citadel');
  } catch (error) {
    console.error('Hyperliquid validation error:', error);
    await ctx.scene.enter('auth_error_hyperliquid');
  }
});

export default validatingHyperliquidScene;
