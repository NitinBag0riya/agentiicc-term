/**
 * CTA TO API MAP
 * Maps callback_data patterns to Universal API methods
 */

export const CTAMap: Record<string, { method: string; pattern: RegExp }> = {
  // Overview & Account
  'CITADEL': { method: 'getAccount', pattern: /^menu$/ },
  'GET_POSITIONS': { method: 'getPositions', pattern: /^positions$/ },
  'GET_ASSETS': { method: 'getAssets', pattern: /^balance$/ },
  'SWITCH_EXCHANGE': { method: 'switchExchange', pattern: /^switch_exchange:/ },

  // Positions & Trading
  'CLOSE_POSITION': { method: 'placeOrder', pattern: /^close:/ },
  'CANCEL_ORDER': { method: 'cancelOrder', pattern: /^cancel_order:/ },
  'CANCEL_ALL': { method: 'cancelAllOrders', pattern: /^cancel_all:/ },
  'SET_LEVERAGE': { method: 'setLeverage', pattern: /^lev:/ },
  'SET_MARGIN': { method: 'setMarginMode', pattern: /^margin:/ },

  // Orders
  'VIEW_ORDERS': { method: 'getOpenOrders', pattern: /^view_orders:/ },
};

/**
 * Identify which API method should be called for a given callback data
 */
export function getExpectedMethod(callbackData: string): string | null {
  for (const [key, mapping] of Object.entries(CTAMap)) {
    if (mapping.pattern.test(callbackData)) {
      return mapping.method;
    }
  }
  return null;
}
