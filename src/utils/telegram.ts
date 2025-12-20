import crypto from 'crypto';

/**
 * Verify Telegram Web App initData signature
 */
export function verifyTelegramWebAppData(
  initData: string,
  botToken: string
): {
  valid: boolean;
  user?: { id: number; first_name: string; username?: string };
} {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      return { valid: false };
    }

    params.delete('hash');

    // Sort params alphabetically
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Generate secret key from bot token
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate expected hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash matches
    if (hash !== expectedHash) {
      console.log('[TelegramAuth] Hash mismatch');
      return { valid: false };
    }

    // Parse user data
    const userParam = params.get('user');
    if (!userParam) {
      return { valid: false };
    }

    const user = JSON.parse(userParam);

    // Check auth_date (within 1 hour)
    const authDate = parseInt(params.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      console.log('[TelegramAuth] Auth data too old');
      return { valid: false };
    }

    return { valid: true, user };
  } catch (error) {
    console.error('[TelegramAuth] Error verifying initData:', error);
    return { valid: false };
  }
}
