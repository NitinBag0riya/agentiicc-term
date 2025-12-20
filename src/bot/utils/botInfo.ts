/**
 * Bot Information Utilities
 * Stores and retrieves bot metadata
 */

let botInfo: {
  id: number;
  username: string;
  firstName: string;
} | null = null;

export function setBotInfo(info: { id: number; username: string; first_name: string }) {
  botInfo = {
    id: info.id,
    username: info.username,
    firstName: info.first_name
  };
}

export function getBotInfo() {
  return botInfo;
}

export function getBotDeepLink(payload: string): string {
  if (!botInfo) {
    throw new Error('Bot info not initialized');
  }
  return `https://t.me/${botInfo.username}?start=${payload}`;
}

export function getBotUsername(): string {
  if (!botInfo) {
    throw new Error('Bot info not initialized');
  }
  return botInfo.username;
}
