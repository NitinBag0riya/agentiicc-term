/**
 * API Unlinking Scene - Functional style
 *
 * Flow: Confirm and unlink API credentials
 * Step 1: Confirm unlinking
 * Step 2: Execute unlink
 */
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { deleteApiCredentials } from '../db/users';
import { exitSceneToMenu } from '../utils/countdown';

/**
 * Unlink API Scene
 */
export const unlinkScene = new Scenes.WizardScene<BotContext>(
  'unlink',

  // ==================== STEP 1: Confirm Unlinking ====================
  async (ctx) => {
    console.log('[UnlinkScene] Step 1: Asking for confirmation');

    // Check if linked
    if (!ctx.session.isLinked) {
      await ctx.reply('❌ You don\'t have any API credentials linked.\n\nUse /link to connect your account.');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as { targetExchange?: string };
    const targetExchange = state.targetExchange || 'aster';
    const exchangeDisplay = targetExchange === 'hyperliquid' ? 'Hyperliquid' : 'Aster DEX';

    // Send confirmation message
    const message = await ctx.reply(
      '⚠️ **Unlink API Credentials**\n\n' +
      `Are you sure you want to unlink your **${exchangeDisplay}** API?\n\n` +
      '**This will:**\n' +
      '• Remove your encrypted API credentials\n' +
      '• Disable all trading functionality\n' +
      '• Require re-linking to trade again\n\n' +
      '⚡ This action is immediate and cannot be undone.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes, Unlink', 'confirm_unlink'),
            Markup.button.callback('❌ Cancel', 'cancel_unlink'),
          ],
        ]),
      }
    );

    // Store message ID
    ctx.wizard.state.mainMessageId = message.message_id;

    return ctx.wizard.next();
  }
);

// ==================== Confirm Unlink Handler ====================
unlinkScene.action('confirm_unlink', async (ctx) => {
  await ctx.answerCbQuery();

  console.log('[UnlinkScene] User confirmed unlinking');

  // Remove buttons from confirmation message
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
      console.log('[UnlinkScene] Could not remove buttons');
    }
  }

  // Send processing message
  await ctx.reply(
    '⏳ **Unlinking API Credentials...**\n\n' +
    'Please wait...',
    { parse_mode: 'Markdown' }
  );

  try {
    // Get user ID from session
    const userId = ctx.session.userId;

    if (!userId) {
      throw new Error('User ID not found in session');
    }

    // Delete credentials from database
    const state = ctx.wizard.state as { targetExchange?: string };
    const targetExchange = state.targetExchange || 'aster';
    await deleteApiCredentials(userId, targetExchange);

    console.log(`[UnlinkScene] ✅ Credentials deleted for user ${userId} exchange ${targetExchange}`);

    // Update session: Check if any exchanges remain
    const { getLinkedExchanges } = await import('../db/users');
    const linkedExchanges = await getLinkedExchanges(userId);
    
    if (linkedExchanges.length === 0) {
        ctx.session.isLinked = false;
        ctx.session.activeExchange = undefined;
    } else {
        // If unlinked active exchange, switch to another
        if (ctx.session.activeExchange === targetExchange) {
            ctx.session.activeExchange = linkedExchanges[0];
        }
    }
    
    // Explicitly clear session user ID only if no links left
    if (linkedExchanges.length === 0) {
        // ctx.session.userId = undefined; // Keeping userId might be safer for re-linking
    }

    console.log(`[UnlinkScene] ✅ Success! Showing menu...`);

    const exchangeDisplay = targetExchange === 'hyperliquid' ? 'Hyperliquid' : 'Aster DEX';

    // Show success and menu
    await exitSceneToMenu(
      ctx,
      '✅ **API Unlinked Successfully**\n\n' +
      `🔓 Your ${exchangeDisplay} API credentials have been removed.\n\n` +
      'Use /link to connect your account again.'
    );

    return ctx.scene.leave();

  } catch (error: unknown) {
    console.error('[UnlinkScene] ❌ Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Show error and menu
    await exitSceneToMenu(
      ctx,
      `❌ **Failed to Unlink API**\n\n` +
      `Error: ${errorMessage}\n\n` +
      'Please try again with /unlink'
    );

    return ctx.scene.leave();
  }
});

// ==================== Cancel Handler ====================
unlinkScene.action('cancel_unlink', async (ctx) => {
  await ctx.answerCbQuery();

  console.log('[UnlinkScene] ❌ User cancelled');

  // Remove buttons from confirmation message
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
      console.log('[UnlinkScene] Could not remove buttons');
    }
  }

  // Show cancelled and menu
  await exitSceneToMenu(
    ctx,
    '❌ **Unlinking Cancelled**\n\n' +
    'Your API credentials remain linked.'
  );

  return ctx.scene.leave();
});

// ==================== Leave Handler ====================
unlinkScene.leave(async (ctx) => {
  console.log('[UnlinkScene] Exited');
  // Clear wizard state
  if (ctx.wizard) {
    ctx.wizard.state = {};
  }
});
