/**
 * Bot Configuration
 */

export const BOT_CONFIG = {
  // Telegram
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  webhookPath: '/webhook/telegram',
  port: parseInt(process.env.BOT_PORT || '3001'),

  // Universal API
  apiBaseUrl: process.env.UNIVERSAL_API_URL || 'http://localhost:3000',

  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY || '',

  // Exchange Configuration
  exchanges: {
    aster: {
      id: 'aster',
      name: 'Aster DEX',
      emoji: '⭐',
      type: 'api_key' as const,
    },
    hyperliquid: {
      id: 'hyperliquid',
      name: 'Hyperliquid',
      emoji: '🌊',
      type: 'wallet' as const,
    },
  },
};

export type ExchangeId = keyof typeof BOT_CONFIG.exchanges;

export function getExchangeConfig(exchangeId: ExchangeId) {
  return BOT_CONFIG.exchanges[exchangeId];
}

export function getExchangeEmoji(exchangeId: ExchangeId): string {
  return BOT_CONFIG.exchanges[exchangeId]?.emoji || '📊';
}

export function getExchangeName(exchangeId: ExchangeId): string {
  return BOT_CONFIG.exchanges[exchangeId]?.name || exchangeId;
}
