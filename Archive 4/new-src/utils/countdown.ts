/**
 * Simple scene exit helper
 *
 * Removes buttons from previous message and shows main menu
 */
import type { BotContext } from '../types/context';
import { showMenu } from '../bot';

/**
 * Remove buttons from callback query message
 * Call this before entering a scene
 */
export async function removeButtonsFromCallback(ctx: BotContext): Promise<void> {
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId && ctx.chat?.id) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat.id,
        messageId,
        undefined,
        undefined
      );
    } catch (e) {
      console.log('[RemoveButtons] Could not remove buttons');
    }
  }
}

/**
 * Exit scene and show main menu
 *
 * @param ctx - Bot context
 * @param message - Final message to show (kept visible, no buttons)
 */
export async function exitSceneToMenu(
  ctx: BotContext,
  message: string
): Promise<void> {
  const chatId = ctx.chat?.id;

  if (!chatId) {
    console.error('[ExitScene] Missing chat ID');
    return;
  }

  try {
    // Step 1: Send final message (no buttons)
    await ctx.reply(message, { parse_mode: 'Markdown' });

    // Step 2: Show main menu (exactly like /menu command)
    await showMenu(ctx);
  } catch (error) {
    console.error('[ExitScene] Error:', error);
    // Fallback: just show menu
    try {
      await showMenu(ctx);
    } catch (e) {
      console.error('[ExitScene] Fallback failed:', e);
    }
  }
}
