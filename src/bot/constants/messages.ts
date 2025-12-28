/**
 * Bot Messages
 * 
 * Centralized message templates for consistent UX.
 */

export const Messages = {
  // Welcome & Help
  welcome: (name: string) => 
    `Welcome to AgentiFi, ${name}! 🚀\n\nYour gateway to decentralized trading.`,
  
  help: `
📚 *AgentiFi Bot Help*

*Commands:*
/start - Start the bot
/menu - Open main menu
/link - Link an exchange
/unlink - Unlink an exchange
/help - Show this help

*Trading:*
• Search any symbol to start trading
• Use buttons to place orders
• Set leverage and margin mode

*Need help?* Contact @support
`,

  // Errors
  error: (msg: string) => `❌ ${msg}`,
  
  sessionExpired: '⏰ Session expired. Please use /start to begin again.',
  
  notLinked: (exchange: string) => 
    `🔗 Please link your ${exchange} account first.\nUse /link to connect.`,
  
  insufficientBalance: '💰 Insufficient balance for this operation.',
  
  // Success
  success: (msg: string) => `✅ ${msg}`,
  
  orderPlaced: (orderId: string) => 
    `✅ Order placed successfully!\nOrder ID: \`${orderId}\``,
  
  orderCanceled: '✅ Order canceled.',
  
  leverageSet: (leverage: number, symbol: string) => 
    `✅ Leverage set to ${leverage}x for ${symbol}`,
  
  // Confirmations
  confirmOrder: 'Please confirm your order:',
  
  canceled: '❌ Operation canceled.',
  
  // Loading
  loading: '⏳ Loading...',
  
  processing: '⏳ Processing...'
};

/**
 * Format price for display
 */
export function formatPrice(price: number | string, decimals: number = 2): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number | string, includeSign: boolean = true): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Format quantity for display
 */
export function formatQuantity(qty: number | string, decimals: number = 4): string {
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  return num.toFixed(decimals);
}
