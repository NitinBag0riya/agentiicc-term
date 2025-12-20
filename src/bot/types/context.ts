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
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext, SessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
