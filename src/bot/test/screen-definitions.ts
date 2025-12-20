/**
 * Screen Definitions - Maps all bot screens and their expected CTAs
 */

export interface ScreenDefinition {
  name: string;
  entryPoint: string; // Command or callback to reach this screen
  expectedCTAs: string[]; // Patterns for expected CTAs
  requiredState?: Partial<any>; // Required session state
  description: string;
}

export const SCREEN_DEFINITIONS: ScreenDefinition[] = [
  {
    name: 'start',
    entryPoint: '/start',
    expectedCTAs: ['menu', 'link_exchange'],
    description: 'Welcome screen',
  },
  {
    name: 'menu',
    entryPoint: 'menu',
    expectedCTAs: ['citadel', 'settings', 'trading', 'link_exchange', 'unlink_exchange'],
    description: 'Main menu',
  },
  {
    name: 'citadel',
    entryPoint: 'citadel',
    expectedCTAs: ['positions', 'assets', 'menu'],
    description: 'Overview/Citadel screen',
  },
  {
    name: 'positions',
    entryPoint: 'positions',
    expectedCTAs: ['pos_refresh:', 'menu'],
    description: 'Futures positions list',
  },
  {
    name: 'position_detail',
    entryPoint: 'pos_refresh:BTCUSDT',
    expectedCTAs: [
      'pos_close:',
      'pos_manage_margin:',
      'pos_leverage_menu:',
      'pos_tpsl_set_tp:',
      'pos_tpsl_set_sl:',
      'pos_manage_orders:',
      'pos_mode_tpsl:',
      'pos_mode_orders:',
    ],
    description: 'Individual position management',
  },
  {
    name: 'assets',
    entryPoint: 'assets',
    expectedCTAs: ['menu'],
    description: 'Spot assets view',
  },
  {
    name: 'settings',
    entryPoint: 'settings',
    expectedCTAs: ['menu'],
    description: 'Settings screen',
  },
  {
    name: 'trading',
    entryPoint: 'trading',
    expectedCTAs: ['menu'],
    description: 'Trading interface',
  },
  {
    name: 'link_exchange',
    entryPoint: 'link_exchange',
    expectedCTAs: ['link_aster', 'link_hyperliquid', 'menu'],
    description: 'Link exchange account',
  },
];

/**
 * CTA patterns that should trigger specific behaviors
 */
export const CTA_PATTERNS = {
  // Position management
  CLOSE_POSITION: /^pos_close:(.+)$/,
  MANAGE_MARGIN: /^pos_manage_margin:(.+)$/,
  LEVERAGE_MENU: /^pos_leverage_menu:(.+)$/,
  SET_LEVERAGE: /^pos_set_leverage:(.+):(\d+)$/,
  LEVERAGE_CUSTOM: /^pos_leverage_custom:(.+)$/,
  
  // TP/SL
  SET_TP: /^pos_tpsl_set_tp:(.+)$/,
  SET_SL: /^pos_tpsl_set_sl:(.+)$/,
  SET_BOTH: /^pos_tpsl_set_both:(.+)$/,
  MODIFY_TP: /^pos_tpsl_modify_tp:(.+)$/,
  MODIFY_SL: /^pos_tpsl_modify_sl:(.+)$/,
  REMOVE_TP: /^pos_tpsl_remove_tp:(.+):(.+)$/,
  REMOVE_SL: /^pos_tpsl_remove_sl:(.+):(.+)$/,
  
  // Orders
  MANAGE_ORDERS: /^pos_manage_orders:(.+)$/,
  CANCEL_ALL: /^pos_cancel_all:(.+)$/,
  CANCEL_CUSTOM: /^pos_cancel_custom:(.+)$/,
  
  // Trading
  LONG: /^long:(.+)$/,
  SHORT: /^short:(.+)$/,
  APE: /^ape:(.+)$/,
  SELL: /^sell:(.+)$/,
  
  // Navigation
  REFRESH: /^pos_refresh:(.+)$/,
  MODE_TPSL: /^pos_mode_tpsl:(.+)$/,
  MODE_ORDERS: /^pos_mode_orders:(.+)$/,
  
  // Settings
  TOGGLE_ORDER_TYPE: /^pos_toggle_order_type:(.+)$/,
  TOGGLE_MARGIN: /^pos_toggle_margin:(.+)$/,
};

/**
 * Expected API calls for each CTA pattern
 */
export const CTA_TO_API: Record<string, string> = {
  'pos_close:': 'placeOrder',
  'pos_manage_margin:': 'updatePositionMargin',
  'pos_set_leverage:': 'setLeverage',
  'pos_tpsl_set_tp:': 'placeOrder',
  'pos_tpsl_set_sl:': 'placeOrder',
  'pos_tpsl_set_both:': 'placeOrder',
  'pos_cancel_all:': 'cancelAllOrders',
  'long:': 'placeOrder',
  'short:': 'placeOrder',
  'ape:': 'placeOrder',
  'sell:': 'placeOrder',
};
