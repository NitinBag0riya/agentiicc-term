import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';

export const validatingHyperliquidScene = new Scenes.BaseScene<BotContext>('validating_hyperliquid');

// Enter handler - Screen 10: Validating Hyperliquid Connection
validatingHyperliquidScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '⏳ Validating Hyperliquid',
    '   Connection',
    '',
    'Testing API credentials...',
    '▓▓▓▓▓▓░░░░░░░░░░░░░',
    '',
    'Connecting to Hyperliquid...',
    'Fetching account data...',
    '',
    'This may take a few',
    'seconds.'
  ];

  const message = createBox('Validating', lines, 32);

  await ctx.reply('```\n' + message + '\n```', { parse_mode: 'MarkdownV2' });
  
  // Simulate validation delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Check if we have temp credentials
  const walletAddress = ctx.session.tempWalletAddress;
  const apiKey = ctx.session.tempApiKey;
  
  if (!walletAddress || !apiKey) {
    await ctx.scene.enter('auth_error_hyperliquid');
    return;
  }
  
  // Encrypt credentials (API Key = Private Key, Secret = Wallet Address for Hyperliquid mapping)
  const { encrypt } = require('../../utils/encryption');
  const { storeApiCredentials, getOrCreateUser } = require('../../db/users');
  
  const encKey = encrypt(apiKey); // Private Key
  const encSecret = encrypt(walletAddress); // Wallet Address
  
  // Store in database
  const telegramId = ctx.from?.id;
  if (telegramId) {
     const user = await getOrCreateUser(telegramId, ctx.from?.username);
     if (user && user.id) {
        await storeApiCredentials(user.id, 'hyperliquid', encKey, encSecret);
        ctx.session.userId = user.id;
     }
  }
  
  // Set session state
  ctx.session.linkExchange = 'hyperliquid';
  ctx.session.isLinked = true;
  ctx.session.activeExchange = 'hyperliquid';
  
  // Clear temp session data
  delete ctx.session.tempWalletAddress;
  delete ctx.session.tempApiKey;
  
  // Success - go to Universal Citadel
  await ctx.reply('✅ Successfully connected to Hyperliquid!');
  await ctx.scene.enter('universal_citadel');
});

export default validatingHyperliquidScene;
