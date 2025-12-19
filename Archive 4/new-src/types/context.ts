/**
 * Bot context types
 * Functional style
 */
import { Context, Scenes } from 'telegraf';

/**
 * Session data stored in Redis
 */
export interface SessionData {
  // User identification
  userId?: number; // Database user ID
  telegramId?: number;
  username?: string;

  // Link status
  isLinked?: boolean;

  // Deep link data (for clickable assets/positions)
  tempSpotAssets?: string[];
  tempPositions?: string[];
  tempIsolatedPositions?: string[];
  overviewMessageId?: number;

  // Symbol search results
  searchResults?: Array<{ symbol: string; type: 'spot' | 'futures' }>;

  // Trading state per symbol
  tradingState?: {
    [symbol: string]: {
      orderType: 'Market' | 'Limit';
      leverage: number;
      marginType: 'cross' | 'isolated';
      messageId?: number; // For editing same message on refresh
      openOrders?: Array<{ orderId: number; [key: string]: any }>; // For index-based order cancellation
    };
  };

  // Waiting for user input (for Ape X, Sell X custom amounts, TP/SL)
  waitingForInput?: {
    action: 'ape_custom' | 'sell_custom' | 'leverage_custom' | 'long_custom' | 'short_custom' | 'cancel_custom' |
            'tpsl_set_tp' | 'tpsl_set_sl' | 'tpsl_set_both' | 'tpsl_modify_tp' | 'tpsl_modify_sl';
    symbol: string;
    retryCount?: number; // Track invalid input attempts (max 2)
  };

  // Message cleanup - track messages with buttons for removal
  buttonMessages?: number[];

  // Scene data (managed by Telegraf)
  __scenes?: any;
}

/**
 * Extended context with session, scenes, and injected services
 */
export interface BotContext extends Context {
  // Session (stored in Redis)
  session: SessionData;

  // Scene support
  scene: Scenes.SceneContextScene<BotContext>;
  wizard?: Scenes.WizardContextWizard<BotContext>;
}

/**
 * Wizard state (temporary, in-memory during scene)
 */
export interface WizardState {
  // API linking
  apiKey?: string;
  apiSecret?: string;

  // Trading
  symbol?: string;
  side?: 'BUY' | 'SELL';
  amount?: number;
  orderType?: 'MARKET' | 'LIMIT';
  price?: number;

  // Generic state
  [key: string]: any;
}
