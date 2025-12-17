/**
 * Button Cleanup Utilities
 *
 * Tracks and cleans up button messages to prevent clutter
 */
import type { BotContext } from '../types/context';

/**
 * Clean up old button messages by removing their buttons
 */
export async function cleanupButtonMessages(ctx: BotContext, keepMessageId?: number): Promise<void> {
    if (!ctx.session.buttonMessages || ctx.session.buttonMessages.length === 0) {
        return;
    }

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
