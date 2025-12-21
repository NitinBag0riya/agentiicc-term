import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const searchResultsScene = new Scenes.BaseScene<BotContext>('search_results');

// Enter handler - Screen 18: Search Results
searchResultsScene.enter(async (ctx) => {
  const symbol = ctx.session.searchSymbol || 'SOL';
  const exchange = ctx.session.activeExchange || 'aster';
  
  // Construct the trading symbol
  const tradingSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
  
  const { createBox } = require('../utils/format');

  const lines = [
    `🔍 Search Results for "${symbol}"`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ Futures Markets:',
    `• ${tradingSymbol}`,
    '',
    'Click to see details',
    'and trade',
    '━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`⚡ ${tradingSymbol} (Perp)`, `select_symbol_${tradingSymbol}`),
      ],
      [
        Markup.button.callback('🏰 Back to Citadel', 'back_citadel'),
      ],
    ]),
  });
});

searchResultsScene.action(/select_symbol_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const symbol = ctx.match[1];
  ctx.session.tradingSymbol = symbol;
  await ctx.scene.enter('position_no_open');
});

searchResultsScene.action('back_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default searchResultsScene;
