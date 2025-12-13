/**
 * Unlink Scene - Remove Exchange Credentials
 * 
 * Flow: Confirm → Delete from DB → Clear Session
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { deleteApiCredentials } from '../../db/users';
import { getExchangeName } from '../config';

export const unlinkScene = new Scenes.WizardScene<BotContext>(
  'unlink',

  // ==================== STEP 1: Confirm Unlinking ====================
  async (ctx) => {
    console.log('[UnlinkScene] Step 1: Asking for confirmation');

    // Check if linked
    if (!ctx.session.isLinked || !ctx.session.activeExchange) {
      await ctx.reply('❌ You don\'t have any API credentials linked.\\n\\nUse /link to connect your account.');
      return ctx.scene.leave();
    }

    // Get exchange name for display
    const exchangeName = getExchangeName(ctx.session.activeExchange as any);

    // Send confirmation message
    const message = await ctx.reply(
      '⚠️ **Unlink API Credentials**\\n\\n' +
      `Are you sure you want to unlink your ${exchangeName} API?\\n\\n` +
      '**This will:**\\n' +
      '• Remove your encrypted API credentials\\n' +
      '• Disable all trading functionality\\n' +
      '• Require re-linking to trade again\\n\\n' +
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
    (ctx.wizard.state as any).mainMessageId = message.message_id;

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

  // Get exchange name for display
  const exchangeName = getExchangeName(ctx.session.activeExchange as any);

  // Send processing message
  await ctx.reply(
    '⏳ **Unlinking API Credentials...**\\n\\n' +
    'Please wait...',
    { parse_mode: 'Markdown' }
  );

  try {
    // Get user ID from session
    const userId = ctx.session.userId;
    const currentExchange = ctx.session.activeExchange;

    if (!userId || !currentExchange) {
      throw new Error('User ID or exchange not found in session');
    }

    // Delete credentials from database
    await deleteApiCredentials(userId, currentExchange);

    console.log(`[UnlinkScene] ✅ Credentials deleted for user ${userId} on ${currentExchange}`);

    // Update session
    ctx.session.isLinked = false;
    ctx.session.userId = undefined;
    ctx.session.activeExchange = undefined;
    ctx.session.linkedExchanges = [];
    ctx.session.apiTokens = {};

    console.log(`[UnlinkScene] ✅ Success! Showing menu...`);

    // Show success
    await ctx.reply(
      '✅ **API Unlinked Successfully**\\n\\n' +
      `🔓 Your ${exchangeName} API credentials have been removed.\\n\\n` +
      'Use /link to connect your account again.',
      { parse_mode: 'Markdown' }
    );

    return ctx.scene.leave();

  } catch (error: unknown) {
    console.error('[UnlinkScene] ❌ Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Show error
    await ctx.reply(
      `❌ **Failed to Unlink API**\\n\\n` +
      `Error: ${errorMessage}\\n\\n` +
      'Please try again with /unlink',
      { parse_mode: 'Markdown' }
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

  // Show cancelled
  await ctx.reply(
    '❌ **Unlinking Cancelled**\\n\\n' +
    'Your API credentials remain linked.',
    { parse_mode: 'Markdown' }
  );

  return ctx.scene.leave();
});

// ==================== Leave Handler ====================
unlinkScene.leave(async (ctx) => {
  console.log('[UnlinkScene] Exited');
  // Clear wizard state
  if (ctx.wizard) {
    (ctx.wizard as any).state = {};
  }
});
