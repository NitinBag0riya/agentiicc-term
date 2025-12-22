/**
 * API Linking Scene - Functional style
 *
 * Flow: Remove buttons, send new messages
 * Step 1: Request API key
 * Step 2: Request API secret
 * Step 3: Validate & save
 * End: Show summary and menu
 */
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { getOrCreateUser, storeApiCredentials } from '../db/users';
import { encrypt } from '../utils/encryption';
import { getRedis } from '../db/redis';
import { testApiCredentials } from '../aster/helpers';
import { exitSceneToMenu } from '../utils/countdown';

/**
 * Link API Scene
 */
export const linkScene = new Scenes.WizardScene<BotContext>(
  'link',

  // ==================== STEP 1: Ask for API Key ====================
  async (ctx) => {
    console.log('[LinkScene] Step 1: Asking for API key');

    // Check if already linked
    if (ctx.session.isLinked) {
      await ctx.reply('✅ You already have API credentials linked.\n\nUse /unlink to disconnect first.');
      return ctx.scene.leave();
    }

    // Initialize retry counter
    ctx.wizard.state.retryCount = 0;

    // Send initial message
    const message = await ctx.reply(
      '🔗 **Link Your Aster DEX API**\n\n' +
      '**Step 1 of 2:** Send your API Key\n\n' +
      '📝 How to get your API credentials:\n' +
      '1. Visit aster.exchange\n' +
      '2. Go to Account → API Management\n' +
      '3. Create API key with trading permissions\n' +
      '⚠️ **4. Copy both API Key and API Secret before proceeding!**\n\n' +
      '🔒 Your credentials are encrypted before storage.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cancel_link')],
        ]),
      }
    );

    // Store message ID to remove buttons later
    ctx.wizard.state.step1MessageId = message.message_id;

    return ctx.wizard.next();
  },

  // ==================== STEP 2: Receive API Key, Ask for Secret ====================
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('❌ Please send text only', { reply_to_message_id: ctx.message?.message_id });
      return;
    }

    const apiKey = ctx.message.text.trim();

    // Check if user typed a command (e.g., /menu, /start)
    if (apiKey.startsWith('/')) {
      console.log('[LinkScene] Command detected, exiting wizard');
      await exitSceneToMenu(
        ctx,
        '❌ **Linking Cancelled**\n\n' +
        'You can restart anytime with /link'
      );
      return ctx.scene.leave();
    }

    // Validate API key
    if (apiKey.length < 10) {
      ctx.wizard.state.retryCount++;

      if (ctx.wizard.state.retryCount >= 2) {
        console.log('[LinkScene] Too many invalid attempts');
        await exitSceneToMenu(
          ctx,
          '⚠️ **Too many invalid attempts**\n\n' +
          'API linking cancelled. Try again with /link'
        );
        return ctx.scene.leave();
      }

      await ctx.reply('❌ API key seems too short. Please send a valid API key:', { reply_to_message_id: ctx.message.message_id });
      return; // Stay on same step
    }

    // Store API key
    ctx.wizard.state.apiKey = apiKey;
    ctx.wizard.state.retryCount = 0; // Reset for next step
    console.log(`[LinkScene] Step 2: API key received`);

    // Remove buttons from Step 1 message
    const step1MessageId = ctx.wizard.state.step1MessageId;
    if (step1MessageId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          step1MessageId,
          undefined,
          undefined
        );
      } catch (e) {
        console.log('[LinkScene] Could not remove buttons from step 1');
      }
    }

    // Send NEW message for Step 2
    const step2Message = await ctx.reply(
      '✅ **API Key received**\n\n' +
      '**Step 2 of 2:** Send your API Secret\n\n' +
      'Now send your API Secret.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cancel_link')],
        ]),
      }
    );

    // Store step 2 message ID to remove buttons later
    ctx.wizard.state.step2MessageId = step2Message.message_id;

    return ctx.wizard.next();
  },

  // ==================== STEP 3: Validate & Save ====================
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('❌ Please send text only', { reply_to_message_id: ctx.message?.message_id });
      return;
    }

    const apiSecret = ctx.message.text.trim();
    const apiKey = ctx.wizard.state.apiKey;

    // Check if user typed a command (e.g., /menu, /start)
    if (apiSecret.startsWith('/')) {
      console.log('[LinkScene] Command detected, exiting wizard');
      await exitSceneToMenu(
        ctx,
        '❌ **Linking Cancelled**\n\n' +
        'You can restart anytime with /link'
      );
      return ctx.scene.leave();
    }

    // Validate API secret
    if (apiSecret.length < 20) {
      ctx.wizard.state.retryCount++;

      if (ctx.wizard.state.retryCount >= 2) {
        console.log('[LinkScene] Too many invalid attempts');
        await exitSceneToMenu(
          ctx,
          '⚠️ **Too many invalid attempts**\n\n' +
          'API linking cancelled. Try again with /link'
        );
        return ctx.scene.leave();
      }

      await ctx.reply('❌ API secret seems too short. Please send a valid API secret:', { reply_to_message_id: ctx.message.message_id });
      return;
    }

    if (!apiKey) {
      await ctx.reply('❌ Session expired. Please restart with /link');
      return ctx.scene.leave();
    }

    console.log(`[LinkScene] Step 3: Validating credentials...`);

    // Remove buttons from Step 2 message
    const step2MessageId = ctx.wizard.state.step2MessageId;
    if (step2MessageId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          step2MessageId,
          undefined,
          undefined
        );
      } catch (e) {
        console.log('[LinkScene] Could not remove buttons from step 2');
      }
    }

    // Send validation message
    await ctx.reply(
      '✅ **API Secret received**\n\n' +
      '⏳ Validating your credentials with AsterDex...',
      { parse_mode: 'Markdown' }
    );

    try {
      // Validate credentials with AsterDex API
      const redis = getRedis();
      const validationResult = await testApiCredentials(apiKey, apiSecret, redis);

      if (!validationResult.valid) {
        // Validation failed
        console.log(`[LinkScene] ❌ Validation failed`);

        await exitSceneToMenu(
          ctx,
          `❌ **Credential Validation Failed**\n\n` +
          `${validationResult.error || 'Invalid API credentials'}\n\n` +
          'Try again with /link'
        );

        return ctx.scene.leave();
      }

      console.log(`[LinkScene] ✅ Credentials validated successfully`);

      // Get or create user
      const user = await getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username
      );

      // Encrypt credentials
      const encryptedKey = encrypt(apiKey);
      const encryptedSecret = encrypt(apiSecret);

      // Save to PostgreSQL
      await storeApiCredentials(
        user.id,
        encryptedKey,
        encryptedSecret,
        false // testnet
      );

      console.log(`[LinkScene] ✅ Credentials saved for user ${user.id}`);

      // Update session
      ctx.session.userId = user.id;
      ctx.session.telegramId = ctx.from!.id;
      ctx.session.username = ctx.from!.username;
      ctx.session.isLinked = true;

      console.log(`[LinkScene] ✅ Success! Showing menu...`);

      // Show success and menu
      await exitSceneToMenu(
        ctx,
        '✅ **API Successfully Linked!**\n\n' +
        '🎉 Your Aster DEX account is now connected.\n\n' +
        '**Summary:**\n' +
        '• API credentials encrypted and stored\n' +
        '• Ready to trade on Aster DEX'
      );

      return ctx.scene.leave();

    } catch (error: unknown) {
      console.error('[LinkScene] ❌ Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Show error and menu
      await exitSceneToMenu(
        ctx,
        `❌ **Failed to link API**\n\n` +
        `Error: ${errorMessage}\n\n` +
        'Please try again with /link'
      );

      return ctx.scene.leave();
    }
  }
);

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
  await exitSceneToMenu(
    ctx,
    '❌ **Linking Cancelled**\n\n' +
    'You can restart anytime with /link'
  );

  return ctx.scene.leave();
});

// ==================== Leave Handler ====================
linkScene.leave(async (ctx) => {
  console.log('[LinkScene] Exited');
  // Clear wizard state
  if (ctx.wizard) {
    ctx.wizard.state = {};
  }
});
