/**
 * Message Formatting Utilities
 */

/**
 * Format account balance for display
 */
export function formatAccountBalance(account: any): string {
  if (!account || typeof account !== 'object') {
    return '❌ **Unable to load account data**\n\nPlease try again or contact support.';
  }

  const totalBalance = parseFloat(account.totalBalance || account.balance || '0');
  const availableBalance = parseFloat(account.availableBalance || account.available || '0');
  const usedMargin = totalBalance - availableBalance;

  return (
    `💰 **Account Balance**\n\n` +
    `**Total Balance:** $${totalBalance.toFixed(2)}\n` +
    `**Available:** $${availableBalance.toFixed(2)}\n` +
    `**Used Margin:** $${usedMargin.toFixed(2)}`
  );
}

/**
 * Format position for display
 */
export function formatPosition(position: any): string {
  const size = parseFloat(position.positionAmt || position.size || '0');
  const entryPrice = parseFloat(position.entryPrice || '0');
  const markPrice = parseFloat(position.markPrice || position.currentPrice || '0');
  const pnl = parseFloat(position.unrealizedProfit || position.pnl || '0');
  const pnlPercent = entryPrice > 0 ? ((markPrice - entryPrice) / entryPrice) * 100 * Math.sign(size) : 0;

  const side = size > 0 ? '🟢 LONG' : size < 0 ? '🔴 SHORT' : '⚪ NONE';
  const pnlEmoji = pnl >= 0 ? '📈' : '📉';

  return (
    `**${position.symbol}** ${side}\n` +
    `Size: ${Math.abs(size).toFixed(4)}\n` +
    `Entry: $${entryPrice.toFixed(2)} | Mark: $${markPrice.toFixed(2)}\n` +
    `${pnlEmoji} PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)\n` +
    `Leverage: ${position.leverage || '?'}x | ${position.marginType || 'cross'}`
  );
}

/**
 * Format multiple positions
 */
export function formatPositions(positions: any): string {
  if (!positions || !Array.isArray(positions)) {
    return '❌ **Unable to load positions**\n\nPlease try again or contact support.';
  }

  if (positions.length === 0) {
    return '📊 **Positions**\n\nNo open positions';
  }

  const openPositions = positions.filter(p => {
    const size = parseFloat(p.positionAmt || p.size || '0');
    return size !== 0;
  });

  if (openPositions.length === 0) {
    return '📊 **Positions**\n\nNo open positions';
  }

  let message = '📊 **Open Positions**\n\n';
  openPositions.forEach((pos, index) => {
    message += formatPosition(pos);
    if (index < openPositions.length - 1) {
      message += '\n\n';
    }
  });

  return message;
}

/**
 * Format order for display
 */
export function formatOrder(order: any): string {
  const side = order.side === 'BUY' ? '🟢 BUY' : '🔴 SELL';
  const type = order.type;
  const price = order.price ? `$${parseFloat(order.price).toFixed(2)}` : 'Market';
  const quantity = parseFloat(order.origQty || order.quantity || '0');

  return (
    `${side} ${order.symbol}\n` +
    `Type: ${type} | Price: ${price}\n` +
    `Quantity: ${quantity.toFixed(4)}\n` +
    `Status: ${order.status}`
  );
}

/**
 * Format error message for user
 */
export function formatError(error: any): string {
  const message = error?.message || error?.toString() || 'Unknown error';
  
  // Clean up common error messages
  if (message.includes('Insufficient balance')) {
    return '❌ Insufficient balance for this operation';
  }
  if (message.includes('Invalid symbol')) {
    return '❌ Invalid trading pair';
  }
  if (message.includes('Invalid leverage')) {
    return '❌ Invalid leverage value';
  }
  if (message.includes('Position not found')) {
    return '❌ No position found for this symbol';
  }
  
  return `❌ Error: ${message}`;
}

/**
 * Format amount input examples
 */
export function getAmountExamples(symbol: string): string {
  const baseAsset = symbol.replace('USDT', '').replace('USD', '');
  return (
    `**Examples:**\n` +
    `• $50 or 50 → $50 USD\n` +
    `• 15% → 15% of available margin\n` +
    `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
  );
}
