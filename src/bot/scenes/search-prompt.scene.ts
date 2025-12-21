import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const searchPromptScene = new Scenes.BaseScene<BotContext>('search_prompt');

// Enter handler - Screen 22: Search Prompt
searchPromptScene.enter(async (ctx) => {
  const message = `┌─────────────────────────────┐
│ 🔍 Search for Asset         │
│                             │
│ Type the symbol you want    │
│ to trade:                   │
│                             │
│ Examples:                   │
│ • BTC                       │
│ • ETH                       │
│ • SOL                       │
│ • ASTER                     │
│                             │
│ 💡 Just type the symbol     │
│    and press enter          │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🏰 Back to Citadel', 'back_citadel'),
      ],
    ]),
  });
});

searchPromptScene.on('text', async (ctx) => {
  const symbol = ctx.message.text.toUpperCase().trim();
  ctx.session.searchSymbol = symbol;
  await ctx.scene.enter('search_results');
});

searchPromptScene.action('back_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default searchPromptScene;
