import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';
import { HyperliquidAdapter } from '../../adapters/hyperliquid.adapter';

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
  
  // Check if we have temp credentials
  const walletAddress = ctx.session.tempWalletAddress;
  const privateKey = ctx.session.tempApiKey;
  
  if (!walletAddress || !privateKey) {
    await ctx.reply('❌ Missing wallet address or private key');
    await ctx.scene.enter('auth_error_hyperliquid');
    return;
  }
  
  // === REAL VALIDATION: Test the API credentials ===
  try {
    // Hyperliquid adapter takes (walletAddress, privateKey)
    const adapter = new HyperliquidAdapter(walletAddress, privateKey);
    const account = await adapter.getAccount();
    
    // If we get here, credentials are valid
    console.log(`[Hyperliquid Validation] Success - Balance: ${account.totalBalance}`);
    
  } catch (error: any) {
    console.error('[Hyperliquid Validation] Failed:', error.message);
    await ctx.reply(`❌ Invalid credentials: ${error.message}`);
    
    // Clear temp data
    delete ctx.session.tempWalletAddress;
    delete ctx.session.tempApiKey;
    
    await ctx.scene.enter('auth_error_hyperliquid');
    return;
  }
  
  // Credentials are valid - now encrypt and store
  const { encrypt } = require('../../utils/encryption');
  const { storeApiCredentials, getOrCreateUser } = require('../../db/users');
  
  // Store: api_key = Private Key, api_secret = Wallet Address (for adapter factory mapping)
  const encKey = encrypt(privateKey);
  const encSecret = encrypt(walletAddress);
  
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
  ctx.session.walletAddress = walletAddress;
  
  // Clear temp session data
  delete ctx.session.tempWalletAddress;
  delete ctx.session.tempApiKey;
  
  // Success - go to Universal Citadel
  await ctx.reply('✅ Successfully connected to Hyperliquid!');
  await ctx.scene.enter('universal_citadel');
});

export default validatingHyperliquidScene;
