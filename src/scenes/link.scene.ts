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
import { getOrCreateUser } from '../db/users';
import { exitSceneToMenu } from '../utils/countdown';

/**
 * Link API Scene
 */
export const linkScene = new Scenes.WizardScene<any>(
  'link',

  // ==================== STEP 1: Ask for API Key ====================
  async (ctx) => {
    console.log('[LinkScene] Step 1: Asking for API key');

    // Get target exchange
    const state = ctx.scene.state as { targetExchange?: string };
    const targetExchange = state.targetExchange || 'aster';
    ctx.wizard.state.targetExchange = targetExchange;
    // Explicitly persist to scene session state
    ctx.scene.session.state.targetExchange = targetExchange;

    const exchangeDisplay = targetExchange === 'hyperliquid' ? 'Hyperliquid' : 'Aster DEX';
    const instructions = targetExchange === 'hyperliquid'
        ? '1. Visit app.hyperliquid.xyz\n2. Connect Wallet -> API\n3. Create API Wallet'
        : '1. Visit aster.exchange\n2. Go to Account → API Management\n3. Create API key with trading permissions';

    // Check if already linked (basic check, could improve to check specific exchange)
    // Check if already linked
    if (ctx.session.linkedExchanges?.includes(targetExchange)) {
      console.log(`[LinkScene] Already linked to ${targetExchange}, switching and redirecting to Citadel`);
      ctx.session.activeExchange = targetExchange;
      const { showOverview } = await import('../composers/overview-menu.composer');
      await showOverview(ctx);
      return ctx.scene.leave();
    }

    // Initialize retry counter
    ctx.wizard.state.retryCount = 0;

    const labelKey = targetExchange === 'hyperliquid' ? 'Wallet Address' : 'API Key';
    const labelSecret = targetExchange === 'hyperliquid' ? 'API Wallet Private Key' : 'API Secret';

    // Send initial message
    const message = await ctx.reply(
      `🔗 **Link Your ${exchangeDisplay} API**\n\n` +
      `**Step 1 of 2 (v2):** Send your ${labelKey}\n\n` +
      '📝 How to get your API credentials:\n' +
      `${instructions}\n` +
      '⚠️ **IMPORTANT**: Use **REAL (Mainnet)** API credentials. Testnet keys may fail validation.\n\n' +
      `⚠️ **4. Copy both ${labelKey} and ${labelSecret} before proceeding!**\n\n` +
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

    // Determine labels again using persistent state
    const targetExchange = ctx.scene.session.state.targetExchange || ctx.wizard.state.targetExchange || 'aster';
    const labelKey = targetExchange === 'hyperliquid' ? 'Wallet Address' : 'API Key';
    const labelSecret = targetExchange === 'hyperliquid' ? 'API Wallet Private Key' : 'API Secret';

    // Send NEW message for Step 2
    const step2Message = await ctx.reply(
      `✅ **${labelKey} received**\n\n` +
      `**Step 2 of 2:** Send your ${labelSecret}\n\n` +
      `Now send your ${labelSecret}.`,
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

    try {
      // Get or create user (locally, to get ID)
      const user = await getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username
      );

      console.log(`[LinkScene] Linking credentials for user ${user.id} via Universal API...`);
      
      const { universalApi } = await import('../services/universalApi');
      const targetExchange = ctx.scene.session.state.targetExchange || ctx.wizard.state.targetExchange || 'aster';
      const exchangeDisplay = targetExchange === 'hyperliquid' ? 'Hyperliquid' : 'Aster DEX';

      // 1. Store credentials via Backend
      let payload;
      if (targetExchange === 'hyperliquid') {
          payload = { address: apiKey, privateKey: apiSecret }; // apiKey holds address, apiSecret holds privateKey
      } else {
          payload = { apiKey, apiSecret };
      }

      const linkResult = await universalApi.linkCredentials(user.id, targetExchange as 'aster' | 'hyperliquid', payload);

      if (!linkResult.success) {
          throw new Error(linkResult.error || 'Failed to store credentials');
      }

      // 2. Init Session (Authentication)
      const sessionInit = await universalApi.initSession(user.id, targetExchange);
      if (!sessionInit) {
           throw new Error('Failed to initialize API session');
      }

      // 3. Validate by fetching account
      await ctx.reply(`⏳ Validating with ${exchangeDisplay}...`, { parse_mode: 'Markdown' });
      const accountRes = await universalApi.getAccount(targetExchange);

      if (!accountRes.success) {
          console.error('[LinkScene] Validation failed:', accountRes.error);
          await ctx.reply(
            `❌ **Validation Failed**\n\n` +
            `Could not verify these credentials with ${exchangeDisplay}.\n` +
            `Error: ${accountRes.error || 'Unknown error'}\n\n` +
            `Possible reasons:\n` +
            `• Invalid API Key or Secret\n` +
            `• Wrong permissions (Trading enabled?)\n` +
            `• IP restriction blocking the bot (Disable IP restriction for API keys)\n\n` +
            `Please try again with /link`,
            { parse_mode: 'Markdown' }
          );
          return ctx.scene.leave();
      }

      console.log(`[LinkScene] ✅ Validation success!`);

      // Update session
      ctx.session.userId = user.id;
      ctx.session.telegramId = ctx.from!.id;
      ctx.session.username = ctx.from!.username;
      ctx.session.isLinked = true;
      ctx.session.activeExchange = targetExchange;

      console.log(`[LinkScene] ✅ Success! Showing menu...`);

      // Show success and menu
      await exitSceneToMenu(
        ctx,
        '✅ **API Successfully Linked!**\n\n' +
        `🎉 Your ${exchangeDisplay} account is now connected via Universal API.\n\n` +
        '**Summary:**\n' +
        '• API credentials verified & stored\n' +
        `• Ready to trade on ${exchangeDisplay}`
      );

      return ctx.scene.leave();

    } catch (error: any) {
      console.error('[LinkScene] ❌ Error:', error);
      const errorMessage = error.message || 'Unknown error';

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
linkScene.action('cancel_link', async (ctx: any) => {
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
// ==================== Leave Handler ====================
linkScene.leave(async (ctx) => {
  console.log('[LinkScene] Exited');
  // Clear wizard state safely
  if (ctx.wizard && ctx.wizard.state) {
    // Object.keys(ctx.wizard.state).forEach(key => delete ctx.wizard.state[key]); // Manual clear if needed
    // But usually leaving scene is enough. The 'read-only' error was likely due to direct assignment.
  }
});
