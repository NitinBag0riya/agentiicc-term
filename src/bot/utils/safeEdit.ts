/**
 * Safe Edit Message Helper
 * Prevents "message is not modified" Telegram errors
 */

export async function safeEditMessage(
  ctx: any,
  text: string,
  extra?: any
): Promise<void> {
  try {
    await ctx.editMessageText(text, extra);
  } catch (error: any) {
    // If message is not modified or can't be edited, send new message instead
    if (
      error.message?.includes('message is not modified') ||
      error.message?.includes('message can\'t be edited') ||
      error.message?.includes('Bad Request')
    ) {
      console.log('[SafeEdit] Message edit failed, sending new message instead');
      await ctx.reply(text, extra);
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}

export async function safeTelegramEditMessage(
  ctx: any,
  chatId: number | string,
  messageId: number,
  text: string,
  extra?: any
): Promise<void> {
  try {
    await ctx.telegram.editMessageText(chatId, messageId, undefined, text, extra);
  } catch (error: any) {
    // If message is not modified or can't be edited, send new message instead
    if (
      error.message?.includes('message is not modified') ||
      error.message?.includes('message can\'t be edited') ||
      error.message?.includes('Bad Request')
    ) {
      console.log('[SafeEdit] Message edit failed, sending new message instead');
      await ctx.telegram.sendMessage(chatId, text, extra);
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}
