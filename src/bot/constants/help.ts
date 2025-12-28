/**
 * Help Messages
 * 
 * Bot help content for linked and unlinked users.
 */

const BOT_FEATURES = 
  '📚 **AgentiFi Trading Bot**\n\n' +
  '**🔗 Supported Exchanges:**\n' +
  '• Aster DEX (Futures)\n' +
  '• Hyperliquid (Perps)\n\n' +
  '━━━━━━━━━━━━━━━━━━━━━━\n' +
  '**🧭 Navigation:**\n\n' +
  '`/menu` - Main Dashboard\n' +
  '`/positions` - View Open Positions\n' +
  '`/help` - This Help Guide\n' +
  '`/settings` - Account Settings\n\n' +
  '**🔎 Quick Search:**\n' +
  'Type any symbol (e.g., `BTC`, `ETH`) to:\n' +
  '• View current price\n' +
  '• Open trading interface\n\n' +
  '━━━━━━━━━━━━━━━━━━━━━━\n' +
  '**📈 Trading:**\n\n' +
  '**Order Types:**\n' +
  '• Market Orders (Instant)\n' +
  '• Limit Orders (Set Price)\n' +
  '• TP/SL (Take Profit / Stop Loss)\n\n' +
  '**Amount Entry:**\n' +
  '• Enter USD value (e.g., `$10`)\n' +
  '• Or use % buttons (25%, 50%, etc.)\n\n' +
  '**Leverage:** 1x - 125x\n' +
  'Set via Position Details → ⚙️ Settings\n\n' +
  '━━━━━━━━━━━━━━━━━━━━━━\n' +
  '**⚙️ Position Management:**\n\n' +
  '• **Close Position:** % or Full\n' +
  '• **Manage Orders:** View/Cancel Open Orders\n' +
  '• **Adjust Margin:** Add/Reduce (Isolated Mode)\n\n' +
  '━━━━━━━━━━━━━━━━━━━━━━\n' +
  '**💡 Tips:**\n\n' +
  '• Switch exchanges via `/settings`\n' +
  '• Aster uses symbols like `BTCUSDT`\n' +
  '• Hyperliquid uses `BTC`, `ETH`\n' +
  '• Min order ~$5 USDT notional\n\n';

/**
 * Get help message based on linked status
 */
export function getHelpMessage(isLinked: boolean): string {
  if (isLinked) {
    return (
      BOT_FEATURES +
      '**🔧 Quick Commands:**\n' +
      '`/menu` - Dashboard\n' +
      '`/positions` - Positions\n' +
      '`/settings` - Settings\n' +
      '`/help` - Help\n\n' +
      '🔗 _Linked to your exchange_'
    );
  }
  
  return (
    '📚 **AgentiFi Trading Bot**\n\n' +
    '**🚀 Getting Started:**\n\n' +
    '1️⃣ Use `/menu` to open the dashboard\n' +
    '2️⃣ Click **Link Account**\n' +
    '3️⃣ Choose your exchange (Aster or Hyperliquid)\n' +
    '4️⃣ Connect via WalletConnect or API Key\n\n' +
    '🔒 Your credentials are encrypted securely\n\n' +
    BOT_FEATURES +
    '**🔧 Commands:**\n' +
    '`/menu` - Open Main Menu\n' +
    '`/help` - Show This Help'
  );
}
