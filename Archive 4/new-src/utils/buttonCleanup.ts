/**
 * Button Cleanup Utilities
 *
 * Shared utilities for tracking and cleaning up button messages
 * across all composers to prevent button clutter
 */
import { BotContext } from '../types/context';

/**
 * Clean up old button messages by removing their buttons
 * Fire-and-forget pattern - doesn't block user actions
 *
 * @param ctx - Bot context
 * @param keepMessageId - Optional message ID to keep (don't remove buttons from this one)
 */
export async function cleanupButtonMessages(ctx: BotContext, keepMessageId?: number): Promise<void> {
  if (!ctx.session.buttonMessages || ctx.session.buttonMessages.length === 0) {
    return;
  }

  // Remove buttons from all tracked messages EXCEPT the one we want to keep
  const messagesToClean = keepMessageId
    ? ctx.session.buttonMessages.filter(id => id !== keepMessageId)
    : ctx.session.buttonMessages;

  for (const messageId of messagesToClean) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat!.id,
        messageId,
        undefined,
        { inline_keyboard: [] }
      );
    } catch (error) {
      // Ignore errors (message might be deleted or too old)
    }
  }

  // Keep only the message we want to preserve (if any)
  ctx.session.buttonMessages = keepMessageId ? [keepMessageId] : [];
}

/**
 * Track a message with buttons for later cleanup
 */
export function trackButtonMessage(ctx: BotContext, messageId: number): void {
  if (!ctx.session.buttonMessages) {
    ctx.session.buttonMessages = [];
  }
  ctx.session.buttonMessages.push(messageId);
}
