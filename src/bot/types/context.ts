import { Context, Scenes } from 'telegraf';

export interface SessionData extends Scenes.WizardSessionData {
  userId?: number;
  authToken?: string;
  activeExchange?: string;
  linkedExchanges?: string[];
  isLinked?: boolean;
  defaultLeverage?: number;
  tradingState?: Record<string, {
    orderType?: 'Market' | 'Limit';
    leverage?: number;
    marginType?: string;
  }>;
  buttonMessages?: number[]; // Track messages with buttons for cleanup
  waitingForInput?: {
    action?: string;
    symbol?: string;
  };
  __scenes?: Scenes.SceneSessionData;
}

export interface BotContext extends Context {
  // Explicitly define session as our SessionData
  session: SessionData;
  // Define scene and wizard properties manually to match Scenes.WizardContext structure but with our context
  scene: Scenes.SceneContextScene<BotContext, SessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
