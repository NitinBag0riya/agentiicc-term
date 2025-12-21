import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const searchResultsUniversalScene = new Scenes.BaseScene<BotContext>('search_results_universal');

// Screen: Universal Search Results (cross-exchange)
searchResultsUniversalScene.enter(async (ctx) => {
  const symbol = ctx.session.searchSymbol || 'SOL';
  const tradingSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
  
  const { createBox } = require('../utils/format');

  const lines = [
    `🔍 Search Results for "${symbol}"`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ Futures Markets:',
    `• ${tradingSymbol} (Aster)`,
    `• ${symbol} (Hyperliquid)`,
    '',
    'Click to see details',
    'and trade'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`🔸 Trade on Aster`, 'trade_aster'),
        Markup.button.callback(`🔸 Trade on Hyperliquid`, 'trade_hyperliquid'),
      ],
      [
        Markup.button.callback('🏰 Back to Citadel', 'back_citadel'),
      ],
    ]),
  });
});

searchResultsUniversalScene.action('trade_aster', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  const symbol = ctx.session.searchSymbol || 'SOL';
  ctx.session.tradingSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
  await ctx.scene.enter('position_no_open');
});

searchResultsUniversalScene.action('trade_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  ctx.session.tradingSymbol = ctx.session.searchSymbol || 'SOL';
  await ctx.scene.enter('position_no_open');
});

searchResultsUniversalScene.action('back_citadel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default searchResultsUniversalScene;
