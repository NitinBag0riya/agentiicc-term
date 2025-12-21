import { Context, Scenes } from 'telegraf';

// WizardSessionData is the data inside the wizard step, not the whole session
export interface SessionData extends Scenes.WizardSessionData {
  __scenes?: any; // Required for Scenes.Stage
  userId?: number;
  telegramId?: number;
  username?: string;
  activeExchange?: string;
  walletAddress?: string;
  isLinked?: boolean;
  waitingForInput?: string;
  tempData?: any;
  [key: string]: any; // Allow dynamic keys for simple UI state (like last leverage)
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, SessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
