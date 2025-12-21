
import { Markup } from 'telegraf';
import type { BotContext } from '../types/context';

/**
 * Welcome message for unlinked users (DFD: welcome screen)
 */
export const WELCOME_MESSAGE_UNLINKED =
  `👋 **Welcome to AgentiFi Trading Bot**

_Your Unified Trading Terminal_

**Choose How to Connect:**

🔗 **API Key** - Connect via exchange API credentials
🔐 **WalletConnect** - One-click wallet connection (Coming Soon)

🔒 _Your credentials are encrypted and stored securely_

**Available Commands:**
/menu - Open main menu
/help - Get help`;

/**
 * Generate inline keyboard for unlinked users
 */
export function getUnlinkedKeyboard(exchange: string = 'aster', userId?: number) {
  const keyboard = Markup.inlineKeyboard([
    // Use process.env.API_URL for dynamic ngrok URL
    [Markup.button.webApp('🔐 Connect Wallet (Web App)', `${process.env.API_URL}/webapp/index.html`)],
    [Markup.button.callback('🏰 Enter Citadel', 'enter_citadel')],
    [Markup.button.callback('🔑 Link API Key', 'link_exchange')]
  ]);
  return keyboard;
}

// Import DB helper
import { getLinkedExchanges } from '../../db/users';

/**
 * Show menu based on login status
 */
export async function showMenu(ctx: BotContext) {
  // REFRESH SESSION: Check DB for latest status
  // API might have updated the link while bot session was stale
  if (ctx.from?.id) {
    const linked = await getLinkedExchanges(ctx.from.id);
    if (linked.length > 0) {
        ctx.session.isLinked = true;
        
        // Ensure active exchange is valid (actually in the linked list)
        // If current activeExchange is NOT in linked list (e.g. 'aster' default but user only linked 'hyperliquid'), switch to first valid one.
        if (!ctx.session.activeExchange || !linked.includes(ctx.session.activeExchange)) {
            ctx.session.activeExchange = linked[0];
        }
    } else {
        ctx.session.isLinked = false;
    }
  }

  if (ctx.session.isLinked) {
    // Show Citadel Overview (Module 2)
    return ctx.scene.enter('citadel');
  } else {
    await ctx.reply(WELCOME_MESSAGE_UNLINKED, {
      parse_mode: 'Markdown',
      ...getUnlinkedKeyboard(ctx.session.activeExchange, ctx.session.userId),
    });
  }
}
