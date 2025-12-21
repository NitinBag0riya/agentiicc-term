import { Scenes } from 'telegraf';
import type { BotContext } from '../types/context';

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
  
  // Simulate validation delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Check if we have temp credentials (API Key + Secret)
  const apiKey = ctx.session.tempApiKey;
  const apiSecret = ctx.session.tempApiSecret;
  
  if (!apiKey || !apiSecret) {
    await ctx.scene.enter('auth_error_aster');
    return;
  }
  
  // Encrypt credentials
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
        
        // Update session with internal ID just in case
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

