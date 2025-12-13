/**
 * Link Scene - Multi-Exchange Account Linking
 * 
 * Supports Aster DEX (API key-based) and Hyperliquid (wallet-based)
 * Flow: Select Exchange → Collect Credentials → Validate & Save
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { getOrCreateUser, storeApiCredentials } from '../../db/users';
import { encrypt } from '../utils/encryption';
import { UniversalApiClient } from '../utils/api-client';
import { getExchangeEmoji, getExchangeName, type ExchangeId } from '../config';

interface LinkState {
  selectedExchange?: ExchangeId;
  currentCredentialIndex: number;
  credentialValues: Record<string, string>;
  retryCount: number;
  step0MessageId?: number;
  lastMessageId?: number;
}

// Exchange configuration
const EXCHANGE_CONFIG = {
  aster: {
    credentials: [
      { name: 'API Key', field: 'apiKey', minLength: 10, placeholder: 'Enter your API Key' },
      { name: 'API Secret', field: 'apiSecret', minLength: 20, placeholder: 'Enter your API Secret' }
    ],
    instructions: [
      'Visit aster.exchange',
      'Go to Account → API Management',
      'Create API key with trading permissions',
      '⚠️ Copy both API Key and API Secret before proceeding!'
    ]
  },
  hyperliquid: {
    credentials: [
      { name: 'Private Key', field: 'privateKey', minLength: 64, placeholder: 'Enter your wallet private key (0x...)' },
      { name: 'Account Address', field: 'accountAddress', minLength: 40, placeholder: 'Enter your wallet address (0x...)' }
    ],
    instructions: [
      'Visit hyperliquid.xyz',
      'Connect your wallet',
      'Export your private key from your wallet',
      'Copy your wallet address',
      '⚠️ Never share your private key with anyone!'
    ]
  }
};

export const linkScene = new Scenes.WizardScene<BotContext>(
  'link',

  // ==================== STEP 0: Select Exchange ====================
  async (ctx) => {
    console.log('[LinkScene] Step 0: Asking for exchange selection');

    // Check if already linked
    if (ctx.session.isLinked && ctx.session.activeExchange) {
      await ctx.reply('✅ You already have an exchange linked.\\n\\nUse /unlink to disconnect first.');
      return ctx.scene.leave();
    }

    // Initialize state
    const state = ctx.wizard.state as LinkState;
    state.retryCount = 0;
    state.credentialValues = {};
    state.currentCredentialIndex = 0;

    // Send exchange selection message
    const message = await ctx.reply(
      '🔗 **Link Your Exchange Account**\\n\\n' +
      'Please select the exchange you want to connect:\\n\\n' +
      '⭐ **Aster DEX** - Decentralized perpetual futures\\n' +
      '🌊 **Hyperliquid** - On-chain perps with deep liquidity\\n\\n' +
      '🔒 All credentials are encrypted before storage.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⭐ Aster DEX', 'select_aster')],
          [Markup.button.callback('🌊 Hyperliquid', 'select_hyperliquid')],
          [Markup.button.callback('❌ Cancel', 'cancel_link')],
        ]),
      }
    );

    state.step0MessageId = message.message_id;

    return ctx.wizard.next();
  },

  // ==================== STEP 1: Collect Credentials ====================
  async (ctx) => {
    // This step handles credential collection
    if (!ctx.message || !('text' in ctx.message)) {
      // If not a text message, ignore (user might have clicked a button)
      return;
    }

    const value = ctx.message.text.trim();
    const state = ctx.wizard.state as LinkState;
    const exchangeId = state.selectedExchange;

    // Check if exchange is selected
    if (!exchangeId) {
      await ctx.reply('❌ Please select an exchange first using the buttons above.');
      return;
    }

    const config = EXCHANGE_CONFIG[exchangeId];
    const currentCredIndex = state.currentCredentialIndex || 0;
    const credential = config.credentials[currentCredIndex];

    // Check if user typed a command
    if (value.startsWith('/')) {
      console.log('[LinkScene] Command detected, exiting wizard');
      await ctx.reply('❌ **Linking Cancelled**\\n\\nYou can restart anytime with /link', { parse_mode: 'Markdown' });
      return ctx.scene.leave();
    }

    // Validate credential length
    if (value.length < credential.minLength) {
      state.retryCount = (state.retryCount || 0) + 1;

      if (state.retryCount >= 3) {
        console.log('[LinkScene] Too many invalid attempts');
        await ctx.reply(
          '⚠️ **Too many invalid attempts**\\n\\n' +
          'API linking cancelled. Try again with /link',
          { parse_mode: 'Markdown' }
        );
        return ctx.scene.leave();
      }

      await ctx.reply(
        `❌ ${credential.name} seems too short (minimum ${credential.minLength} characters).\\n\\n` +
        `Please send a valid ${credential.name}:`
      );
      return;
    }

    // Store credential value
    state.credentialValues[credential.field] = value;
    state.retryCount = 0;
    console.log(`[LinkScene] ${credential.name} received (${value.length} chars)`);

    // Remove buttons from previous message if exists
    const prevMessageId = state.lastMessageId;
    if (prevMessageId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          prevMessageId,
          undefined,
          undefined
        );
      } catch (e) {
        console.log('[LinkScene] Could not remove buttons from previous message');
      }
    }

    // Check if we need more credentials
    const nextCredIndex = currentCredIndex + 1;
    if (nextCredIndex < config.credentials.length) {
      // Ask for next credential
      const nextCred = config.credentials[nextCredIndex];
      const stepNum = nextCredIndex + 1;
      const totalSteps = config.credentials.length;

      const message = await ctx.reply(
        `✅ **${credential.name} received**\\n\\n` +
        `**Step ${stepNum} of ${totalSteps}:** Send your ${nextCred.name}\\n\\n` +
        `📝 ${nextCred.placeholder}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_link')],
          ]),
        }
      );

      state.lastMessageId = message.message_id;
      state.currentCredentialIndex = nextCredIndex;
      return; // Stay on same step
    }

    // ==================== All credentials collected - Validate & Save ====================
    console.log('[LinkScene] All credentials collected, proceeding to validation');

    // Get credentials from state
    const credentials = state.credentialValues;

    // Remove buttons from last message
    const prevMsgId = state.lastMessageId;
    if (prevMsgId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          prevMsgId,
          undefined,
          undefined
        );
      } catch (e) {
        console.log('[LinkScene] Could not remove buttons from previous message');
      }
    }

    // Send validation message
    await ctx.reply(
      `✅ **All credentials received**\\n\\n` +
      `⏳ Validating your credentials with ${getExchangeName(exchangeId)}...`,
      { parse_mode: 'Markdown' }
    );

    try {
      console.log(`[LinkScene] Validating credentials for ${getExchangeName(exchangeId)}...`);

      // Validate credentials based on exchange type
      if (exchangeId === 'hyperliquid') {
        console.log('[LinkScene] Validating Hyperliquid credentials format...');
        // Basic validation for Hyperliquid
        if (!credentials.privateKey.startsWith('0x') || credentials.privateKey.length !== 66) {
          console.log('[LinkScene] ❌ Invalid private key format');
          await ctx.reply(
            `❌ **Invalid Private Key Format**\\n\\n` +
            'Private key should start with 0x and be 66 characters long.\\n\\n' +
            'Try again with /link',
            { parse_mode: 'Markdown' }
          );
          return ctx.scene.leave();
        }
        if (!credentials.accountAddress.startsWith('0x') || credentials.accountAddress.length !== 42) {
          console.log('[LinkScene] ❌ Invalid Account Address Format');
          await ctx.reply(
            `❌ **Invalid Account Address Format**\\n\\n` +
            'Account address should start with 0x and be 42 characters long.\\n\\n' +
            'Try again with /link',
            { parse_mode: 'Markdown' }
          );
          return ctx.scene.leave();
        }
        console.log('[LinkScene] ✅ Hyperliquid credentials format validated');
      }

      console.log(`[LinkScene] ✅ Credentials validated successfully for ${getExchangeName(exchangeId)}`);

      // Get or create user
      console.log('[LinkScene] Getting or creating user...');
      const user = await getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username
      );
      console.log(`[LinkScene] User ID: ${user.id}`);

      // Encrypt and store credentials based on exchange type
      console.log('[LinkScene] Encrypting credentials...');
      let encryptedKey: string;
      let encryptedSecret: string;
      let additionalData: string | undefined;

      if (exchangeId === 'aster') {
        encryptedKey = encrypt(credentials.apiKey);
        encryptedSecret = encrypt(credentials.apiSecret);
      } else if (exchangeId === 'hyperliquid') {
        encryptedKey = encrypt(credentials.privateKey);
        encryptedSecret = encrypt(credentials.accountAddress);
      } else {
        throw new Error('Unsupported exchange');
      }

      console.log('[LinkScene] Credentials encrypted, saving to database...');

      // Save to PostgreSQL
      await storeApiCredentials(
        user.id,
        exchangeId,
        encryptedKey,
        encryptedSecret,
        additionalData
      );

      console.log(`[LinkScene] ✅ Credentials saved for user ${user.id} on ${getExchangeName(exchangeId)}`);

      // Create API session token
      const apiClient = new UniversalApiClient();
      const token = await apiClient.createSession(user.id, exchangeId);

      // Update session
      ctx.session.userId = user.id;
      ctx.session.telegramId = ctx.from!.id;
      ctx.session.username = ctx.from!.username;
      ctx.session.isLinked = true;
      ctx.session.activeExchange = exchangeId;
      ctx.session.linkedExchanges = [exchangeId];
      ctx.session.apiTokens = { [exchangeId]: token };

      console.log(`[LinkScene] ✅ Session updated. Showing success message...`);

      // Show success and menu
      await ctx.reply(
        `✅ **API Successfully Linked!**\\n\\n` +
        `${getExchangeEmoji(exchangeId)} Your ${getExchangeName(exchangeId)} account is now connected.\\n\\n` +
        '**Summary:**\\n' +
        '• API credentials encrypted and stored\\n' +
        `• Ready to trade on ${getExchangeName(exchangeId)}\\n\\n` +
        'Use /menu to start trading!',
        { parse_mode: 'Markdown' }
      );

      console.log(`[LinkScene] ✅ Link complete! Leaving scene...`);
      return ctx.scene.leave();

    } catch (error: unknown) {
      console.error('[LinkScene] ❌ Error during validation/save:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Show error and menu
      await ctx.reply(
        `❌ **Failed to link API**\\n\\n` +
        `Error: ${errorMessage}\\n\\n` +
        'Please try again with /link',
        { parse_mode: 'Markdown' }
      );

      return ctx.scene.leave();
    }
  }
);

// ==================== Exchange Selection Handlers ====================
linkScene.action('select_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await handleExchangeSelection(ctx, 'aster');
});

linkScene.action('select_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await handleExchangeSelection(ctx, 'hyperliquid');
});

async function handleExchangeSelection(ctx: BotContext, exchangeId: ExchangeId) {
  const config = EXCHANGE_CONFIG[exchangeId];
  const state = ctx.wizard.state as LinkState;
  
  console.log(`[LinkScene] Exchange selected: ${getExchangeName(exchangeId)}`);
  
  // Store selected exchange
  state.selectedExchange = exchangeId;
  state.currentCredentialIndex = 0;
  state.credentialValues = {};
  state.retryCount = 0;

  // Remove buttons from step 0 message
  const step0MessageId = state.step0MessageId;
  if (step0MessageId) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat?.id,
        step0MessageId,
        undefined,
        undefined
      );
    } catch (e) {
      console.log('[LinkScene] Could not remove buttons from step 0');
    }
  }

  // Send instructions for first credential
  const firstCred = config.credentials[0];
  const totalSteps = config.credentials.length;

  const message = await ctx.reply(
    `${getExchangeEmoji(exchangeId)} **Link Your ${getExchangeName(exchangeId)} API**\\n\\n` +
    `**Step 1 of ${totalSteps}:** Send your ${firstCred.name}\\n\\n` +
    '📝 **How to get your credentials:**\\n' +
    config.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\\n') + '\\n\\n' +
    `💬 ${firstCred.placeholder}\\n\\n` +
    '🔒 Your credentials are encrypted before storage.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel', 'cancel_link')],
      ]),
    }
  );

  state.lastMessageId = message.message_id;

  // Stay on current step (step 1 - credential collection)
  // The wizard is already on step 1, so we don't need to move
}

// ==================== Cancel Handler ====================
linkScene.action('cancel_link', async (ctx) => {
  await ctx.answerCbQuery();

  console.log('[LinkScene] ❌ User cancelled');

  // Remove buttons from current message
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat?.id,
        messageId,
        undefined,
        undefined
      );
    } catch (e) {
      console.log('[LinkScene] Could not remove buttons');
    }
  }

  // Show cancelled and menu
  await ctx.reply(
    '❌ **Linking Cancelled**\\n\\n' +
    'You can restart anytime with /link',
    { parse_mode: 'Markdown' }
  );

  return ctx.scene.leave();
});

// ==================== Leave Handler ====================
linkScene.leave(async (ctx) => {
  console.log('[LinkScene] Exited');
  // Clear wizard state
  if (ctx.wizard) {
    (ctx.wizard as any).state = {};
  }
});
