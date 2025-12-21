/**
 * Link Scene - Allows users to link Aster or Hyperliquid exchange credentials
 * Accepts both credentials in single message: "credential1 credential2"
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { storeApiCredentials } from '../../db/users';
import { encrypt } from '../../utils/encryption';
import { showMenu } from '../utils/menu';

interface LinkState {
  exchange?: 'aster' | 'hyperliquid';
  apiKey?: string;
  apiSecret?: string;
  accountAddress?: string;
  privateKey?: string;
}

export const linkScene = new Scenes.WizardScene<BotContext>(
  'link',
  
  // Step 0: Choose exchange
  async (ctx) => {
    await ctx.reply(
      '🔗 **Link Exchange**\n\n' +
      'Select which exchange you want to link:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Aster DEX', 'link_aster')],
          [Markup.button.callback('Hyperliquid', 'link_hyperliquid')],
          [Markup.button.callback('❌ Cancel', 'link_cancel')]
        ])
      }
    );
    return ctx.wizard.next();
  },
  
  // Step 1: Process exchange selection and ask for credentials
  async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    
    if (!state.exchange) {
      await ctx.reply('Please select an exchange using the buttons above.');
      return;
    }
    
    if (state.exchange === 'aster') {
      await ctx.reply(
        '🔑 **Aster DEX Credentials**\n\n' +
        'Send your credentials in one message:\n' +
        '`API_KEY API_SECRET`\n\n' +
        'Example:\n' +
        '`abc123xyz def456uvw`\n\n' +
        '_(Separate with a space)_',
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        '🔑 **Hyperliquid Credentials**\n\n' +
        'Send your credentials in one message:\n' +
        '`WALLET_ADDRESS PRIVATE_KEY`\n\n' +
        'Example:\n' +
        '`0x1234...5678 0xabcd...ef01`\n\n' +
        '_(Separate with a space)_',
        { parse_mode: 'Markdown' }
      );
    }
    
    return ctx.wizard.next();
  },
  
  // Step 2: Process both credentials from single message
  async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send a text message with your credentials.');
      return;
    }
    
    const text = ctx.message.text.trim();
    
    if (text === '/cancel') {
      await ctx.reply('❌ Link cancelled.');
      return ctx.scene.leave();
    }
    
    // Parse space-separated credentials
    const parts = text.split(/\s+/);
    
    if (parts.length < 2) {
      await ctx.reply(
        '❌ Invalid format. Please send both credentials separated by a space.\n\n' +
        (state.exchange === 'aster' 
          ? 'Format: `API_KEY API_SECRET`' 
          : 'Format: `WALLET_ADDRESS PRIVATE_KEY`'),
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const [credential1, credential2] = parts;
    
    if (state.exchange === 'aster') {
      // Aster: API Key and Secret
      state.apiKey = credential1;
      state.apiSecret = credential2;
    } else {
      // Hyperliquid: Wallet Address and Private Key
      
      // Validate wallet address format
      if (!credential1.startsWith('0x') || credential1.length !== 42) {
        await ctx.reply(
          '❌ Invalid wallet address format.\n\n' +
          'Address must start with 0x and be 42 characters.\n\n' +
          'Format: `0x1234...5678 privatekey`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Validate and normalize private key
      let privateKey = credential2;
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      if (privateKey.length !== 66) {
        await ctx.reply(
          '❌ Invalid private key format.\n\n' +
          'Private key must be 64 hex characters.\n\n' +
          'Format: `0x1234...5678 abcd...ef01`',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      state.accountAddress = credential1;
      state.privateKey = credential2;
    }
    
    // Save credentials
    await ctx.reply('⏳ Saving credentials...');
    
    // Get or create user
    let userId = ctx.session.userId;
    if (!userId) {
      // User hasn't run /start yet, create them now
      if (!ctx.from) {
        await ctx.reply('❌ Unable to identify user. Please try /start first.');
        return ctx.scene.leave();
      }
      
      const { getOrCreateUser } = await import('../../db/users');
      const user = await getOrCreateUser(ctx.from.id, ctx.from.username);
      ctx.session.userId = user.id;
      userId = user.id;
    }
    
    try {
      if (state.exchange === 'aster') {
        await storeApiCredentials(
          userId,
          'aster',
          encrypt(state.apiKey!),
          encrypt(state.apiSecret!)
        );
      } else {
        await storeApiCredentials(
          userId,
          'hyperliquid',
          encrypt(state.accountAddress!),
          encrypt(state.privateKey!)
        );
      }
      
      ctx.session.activeExchange = state.exchange;
      ctx.session.isLinked = true;
      await ctx.reply(
        `✅ **${state.exchange === 'aster' ? 'Aster' : 'Hyperliquid'} Linked!**

Your credentials are encrypted and stored securely.`,
        { parse_mode: 'Markdown' }
      );
      
      // Enter Citadel Scene
      return ctx.scene.enter('citadel');
      
    } catch (error: any) {
      await ctx.reply(
        `❌ **Failed to link exchange**\n\n` +
        `Error: ${error.message}`,
        { parse_mode: 'Markdown' }
      );
    }
    
    return ctx.scene.leave();
  }
);

// Action handlers
linkScene.action('link_aster', async (ctx) => {
  const state = ctx.wizard.state as LinkState;
  state.exchange = 'aster';
  await ctx.answerCbQuery();
  await ctx.editMessageText('Selected: Aster DEX');
  
  await ctx.reply(
    '🔑 **Aster DEX Credentials**\n\n' +
    'Send your credentials in one message:\n' +
    '`API_KEY API_SECRET`\n\n' +
    'Example:\n' +
    '`abc123xyz def456uvw`\n\n' +
    '_(Separate with a space)_',
    { parse_mode: 'Markdown' }
  );
  
  return ctx.wizard.selectStep(2);
});

linkScene.action('link_hyperliquid', async (ctx) => {
  const state = ctx.wizard.state as LinkState;
  state.exchange = 'hyperliquid';
  await ctx.answerCbQuery();
  await ctx.editMessageText('Selected: Hyperliquid');
  
  await ctx.reply(
    '🔑 **Hyperliquid Credentials**\n\n' +
    '**Option A: One-Click Connection (Recommended)**\n' +
    'Use the Web App to connect securely without keys.\n\n' +
    '**Option B: Manual Linking**\n' +
    'Send your credentials in one message:\n' +
    '`WALLET_ADDRESS PRIVATE_KEY`\n\n' +
    'Example:\n' +
    '`0x1234...5678 0xabcd...ef01`',
    { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
             [Markup.button.webApp('🔐 Connect via Web App', `${process.env.API_URL}/webapp/index.html`)]
        ])
    }
  );
  
  return ctx.wizard.selectStep(2);
});

linkScene.action('link_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Link cancelled.');
  return ctx.scene.leave();
});

// Global Commands
linkScene.command(['menu', 'start'], async (ctx) => {
  await ctx.scene.leave();
  await showMenu(ctx);
});
