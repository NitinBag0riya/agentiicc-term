/**
 * Keyboard Builders
 * 
 * Centralized inline keyboard construction.
 */

import { Markup } from 'telegraf';

/**
 * Common keyboard patterns
 */
export const Keyboards = {
  /**
   * Main menu keyboard
   */
  mainMenu: () => Markup.inlineKeyboard([
    [Markup.button.callback('📊 Portfolio', 'menu')],
    [Markup.button.callback('🔗 Link Exchange', 'link_exchange')],
    [Markup.button.callback('⚙️ Settings', 'settings')],
    [Markup.button.callback('❓ Help', 'help')]
  ]),

  /**
   * Confirmation buttons
   */
  confirm: (operationId: string) => Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', `write_confirm:${operationId}`),
      Markup.button.callback('❌ Cancel', `write_cancel:${operationId}`)
    ]
  ]),

  /**
   * Confirm with recalculate option
   */
  confirmWithRecalc: (operationId: string) => Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', `write_confirm:${operationId}`),
      Markup.button.callback('🔄 Recalc', `write_recalc:${operationId}`)
    ],
    [Markup.button.callback('❌ Cancel', `write_cancel:${operationId}`)]
  ]),

  /**
   * Back to position / menu navigation
   */
  navigation: (symbol?: string) => {
    const buttons = [];
    if (symbol) {
      buttons.push(Markup.button.callback('📊 Back to Position', `return_position:${symbol}`));
    }
    buttons.push(Markup.button.callback('🏠 Menu', 'menu'));
    return Markup.inlineKeyboard([buttons]);
  },

  /**
   * Exchange selector
   */
  exchangeSelector: (exchanges: string[]) => Markup.inlineKeyboard(
    exchanges.map(ex => [Markup.button.callback(
      ex === 'aster' ? '🌟 Aster DEX' : '💎 Hyperliquid',
      `select_exchange:${ex}`
    )])
  ),

  /**
   * Leverage presets
   */
  leveragePresets: (symbol: string) => Markup.inlineKeyboard([
    [
      Markup.button.callback('5x', `set_leverage:${symbol}:5`),
      Markup.button.callback('10x', `set_leverage:${symbol}:10`),
      Markup.button.callback('20x', `set_leverage:${symbol}:20`)
    ],
    [
      Markup.button.callback('50x', `set_leverage:${symbol}:50`),
      Markup.button.callback('100x', `set_leverage:${symbol}:100`),
      Markup.button.callback('Custom', `set_leverage:${symbol}:custom`)
    ],
    [Markup.button.callback('« Back', `return_position:${symbol}`)]
  ]),

  /**
   * Trade side selector (Long/Short)
   */
  tradeSide: (symbol: string) => Markup.inlineKeyboard([
    [
      Markup.button.callback('🟢 Long', `trade:${symbol}:BUY`),
      Markup.button.callback('🔴 Short', `trade:${symbol}:SELL`)
    ],
    [Markup.button.callback('« Back', `return_position:${symbol}`)]
  ]),

  /**
   * Close button only
   */
  close: () => Markup.inlineKeyboard([
    [Markup.button.callback('✖️ Close', 'close_message')]
  ])
};
