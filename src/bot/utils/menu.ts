
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
    [Markup.button.url('✨ Connect via Wallet', `https://your-mini-app.com?startapp=${userId}`)],
    [Markup.button.callback('🏰 Enter Citadel', 'enter_citadel')],
    [Markup.button.callback('🔑 Link API Key', 'link_exchange')]
  ]);
  return keyboard;
}

/**
 * Show menu based on login status
 */
export async function showMenu(ctx: BotContext) {
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
