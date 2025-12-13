import { Context, Scenes } from 'telegraf';

export interface SessionData extends Scenes.WizardSession {
  // User info
  userId?: number;
  telegramId?: number;
  username?: string;
  
  // Exchange management
  linkedExchanges?: string[]; // ['aster', 'hyperliquid']
  activeExchange?: string; // Currently selected exchange
  
  // API session tokens (per exchange)
  apiTokens?: Record<string, string>; // { aster: 'token123', hyperliquid: 'token456' }
  
  // Legacy compatibility
  isLinked?: boolean;
  
  // Wizard state
  wizardData?: any;
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, Scenes.WizardSessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
