
import { Markup } from 'telegraf';
import type { BotContext } from '../types/context';

/**
 * Welcome message for unlinked users (DFD: welcome screen)
 * Matches screen-definitions.ts welcome screen
 */
export const WELCOME_MESSAGE_UNLINKED =
  `👋 **Welcome to StableSolid**

_Your Easy Terminal into Multi-Exchange Trading_

**Choose Exchange to Connect:**

🔸 **Aster DEX**
   Advanced trading features
   Spot & perpetual swaps

🔸 **Hyperliquid**
   High-leverage trading
   BTC/ETH focused

💡 _Connect at least one exchange to get started_
💡 _You can add more later_`;

/**
 * Generate inline keyboard for unlinked users (DFD: welcome screen CTAs)
 */
export function getUnlinkedKeyboard(exchange: string = 'aster', userId?: number) {
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🔸 Aster DEX', 'select_exchange_aster'),
      Markup.button.callback('🔸 Hyperliquid', 'select_exchange_hyperliquid')
    ],
    [Markup.button.callback('❓ Help', 'help')]
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

  console.log('[Debug] showMenu: isLinked =', ctx.session.isLinked);

  if (ctx.session.isLinked) {
    // Show Universal Citadel (DFD-based multi-exchange dashboard)
    console.log('[Debug] Entering universal_citadel scene');
    return ctx.scene.enter('universal_citadel');
  } else {
    // Enter welcome scene for unlinked users (CTAs handled by scene)
    console.log('[Debug] Entering welcome scene');
    return ctx.scene.enter('welcome');
  }
}
