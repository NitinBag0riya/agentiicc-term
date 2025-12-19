import { Context, Scenes } from 'telegraf';

export interface BotSession extends Scenes.WizardSessionData {
  userId?: number;
  activeExchange?: 'aster' | 'hyperliquid';
  isLinked?: boolean;
  __scenes?: Scenes.WizardSession<Scenes.WizardSessionData>;
}

export interface BotContext extends Context {
  session: BotSession;
  scene: Scenes.SceneContextScene<BotContext, BotSession>;
  wizard: Scenes.WizardContextWizard<BotContext>;
}
