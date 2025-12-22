import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';
import { AsterAdapter } from '../../adapters/aster.adapter';

export const validatingAsterScene = new Scenes.BaseScene<BotContext>('validating_aster');

// Enter handler - Validating Aster Connection
validatingAsterScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '⏳ Validating Aster DEX',
    '   Connection',
    '',
    'Testing API credentials...',
    '▓▓▓▓▓▓░░░░░░░░░░░░░',
    '',
    'Connecting to Aster DEX...',
    'Fetching account data...',
    '',
    'This may take a few',
    'seconds.'
  ];

  const message = createBox('Validating', lines, 32);

  await ctx.reply('```\n' + message + '\n```', { parse_mode: 'MarkdownV2' });
  
  // Check if we have temp credentials (API Key + Secret)
  const apiKey = ctx.session.tempApiKey;
  const apiSecret = ctx.session.tempApiSecret;
  
  if (!apiKey || !apiSecret) {
    await ctx.reply('❌ Missing API credentials');
    await ctx.scene.enter('auth_error_aster');
    return;
  }
  
  // === REAL VALIDATION: Test the API credentials ===
  try {
    const adapter = new AsterAdapter(apiKey, apiSecret);
    const account = await adapter.getAccount();
    
    // If we get here, credentials are valid
    console.log(`[Aster Validation] Success - Balance: ${account.totalBalance}`);
    
  } catch (error: any) {
    console.error('[Aster Validation] Failed:', error.message);
    await ctx.reply(`❌ Invalid API credentials: ${error.message}`);
    
    // Clear temp data
    delete ctx.session.tempApiKey;
    delete ctx.session.tempApiSecret;
    
    await ctx.scene.enter('auth_error_aster');
    return;
  }
  
  // Credentials are valid - now encrypt and store
  const { encrypt } = require('../../utils/encryption');
  const { storeApiCredentials, getOrCreateUser } = require('../../db/users');
  
  const encKey = encrypt(apiKey);
  const encSecret = encrypt(apiSecret);
  
  // Store in database
  const telegramId = ctx.from?.id;
  if (telegramId) {
     const user = await getOrCreateUser(telegramId, ctx.from?.username);
     if (user && user.id) {
        await storeApiCredentials(user.id, 'aster', encKey, encSecret);
        
        // Update session with internal ID
        ctx.session.userId = user.id;
     }
  }
  
  // Set session state
  ctx.session.linkExchange = 'aster';
  ctx.session.isLinked = true;
  ctx.session.activeExchange = 'aster';
  
  // Clear temp session data
  delete ctx.session.tempApiKey;
  delete ctx.session.tempApiSecret;
  
  // Success - go to Universal Citadel
  await ctx.reply('✅ Successfully connected to Aster DEX!');
  await ctx.scene.enter('universal_citadel');
});

export default validatingAsterScene;

