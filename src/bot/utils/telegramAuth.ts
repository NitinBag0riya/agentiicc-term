import { createHmac } from 'crypto';

/**
 * Validate Telegram WebApp initData
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function validateWebAppData(initData: string, botToken: string): { isValid: boolean, userData?: any } {
  if (!initData) return { isValid: false };

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return { isValid: false };
    
    urlParams.delete('hash');
    
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');
      
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
      
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
      
    if (computedHash !== hash) {
      return { isValid: false };
    }
    
    // Parse user data
    const userStr = urlParams.get('user');
    const userData = userStr ? JSON.parse(userStr) : null;
    
    return { isValid: true, userData };
  } catch (error) {
    console.error('Error validating initData:', error);
    return { isValid: false };
  }
}
