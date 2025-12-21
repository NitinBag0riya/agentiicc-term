import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const searchPromptUniversalScene = new Scenes.BaseScene<BotContext>('search_prompt_universal');

// Enter handler - Screen 52: Universal Search Prompt
searchPromptUniversalScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔍 Universal Search',
    '',
    'Search across all',
    'connected exchanges:',
    '',
    '✅ Aster DEX',
    '✅ Hyperliquid',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'Type the symbol to trade:',
    'e.g. BTC, ETH, SOL',
    '',
    'Results will show markets',
    'on each exchange'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🏰 Back to Citadel', 'back_citadel'),
      ],
    ]),
  });
});

searchPromptUniversalScene.on('text', async (ctx) => {
  const symbol = ctx.message.text.toUpperCase().trim();
  ctx.session.searchSymbol = symbol;
  await ctx.scene.enter('search_results_universal');
});

searchPromptUniversalScene.action('back_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default searchPromptUniversalScene;
