import { Context, Scenes } from 'telegraf';

export interface SessionData extends Scenes.SceneSession {
  userId?: number;
  telegramId?: number;
  username?: string;
  activeExchange?: string;
  isLinked?: boolean;
  waitingForInput?: string;
  tempData?: any;
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext>;
}
