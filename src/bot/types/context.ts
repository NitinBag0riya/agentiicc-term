import { Context, Scenes } from 'telegraf';

export interface SessionData {
  userId?: number;
  activeExchange?: string;
  isLinked?: boolean;
}

export interface BotContext extends Context {
  session: SessionData;
  scene: Scenes.SceneContextScene<BotContext>;
}
