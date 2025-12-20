/**
 * Bot Info Utility
 *
 * Stores and provides bot information fetched from Telegram
 */

import type { UserFromGetMe } from 'telegraf/typings/core/types/typegram';

let botInfo: UserFromGetMe | null = null;

/**
 * Set bot info (called once at startup)
 */
export function setBotInfo(info: UserFromGetMe): void {
  botInfo = info;
  console.log(`[BotInfo] Bot username set: @${info.username}`);
}

/**
 * Get bot username (e.g., "dexwitch_bot")
 * Returns fallback if bot info not loaded yet
 */
export function getBotUsername(): string {
  return botInfo?.username || 'bot';
}

/**
 * Get full bot info
 */
export function getBotInfo(): UserFromGetMe | null {
  return botInfo;
}

/**
 * Get bot deep link URL
 * @param param - The deep link parameter (e.g., "symbol-1", "position-0")
 */
export function getBotDeepLink(param?: string): string {
  const username = getBotUsername();
  const base = `https://t.me/${username}`;
  return param ? `${base}?start=${param}` : base;
}
