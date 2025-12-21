import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ExchangeCredentialService } from '../../services/exchange-credential.service';

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
  
  // Attempt to validate credentials
  try {
    const walletAddress = ctx.session.tempWalletAddress;
    const apiKey = ctx.session.tempApiKey;
    const userId = ctx.from?.id?.toString();
    
    if (!userId || !walletAddress || !apiKey) {
      await ctx.scene.enter('auth_error_aster');
      return;
    }
    
    // Save and validate credentials
    await ExchangeCredentialService.saveCredentials(userId, 'aster', {
      walletAddress,
      apiKey,
    });
    
    // Clear temp session data
    delete ctx.session.tempWalletAddress;
    delete ctx.session.tempApiKey;
    
    // Success - go to Universal Citadel
    await ctx.reply('✅ Successfully connected to Aster DEX!');
    await ctx.scene.enter('universal_citadel');
  } catch (error) {
    console.error('Aster validation error:', error);
    await ctx.scene.enter('auth_error_aster');
  }
});

export default validatingAsterScene;
