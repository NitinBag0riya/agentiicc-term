import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmClosePositionScene = new Scenes.BaseScene<BotContext>('confirm_close_position');

// Enter handler - Screen: Confirm Close Position
confirmClosePositionScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'UNKNOWN';
  
  const { createBox } = require('../utils/format');

  const lines = [
    '⚠️ Close Position?',
    '',
    'You are about to close your',
    `${symbol} position.`,
    '',
    '---',
    '',
    'This will:',
    '• Close your entire position',
    '• Execute at market price',
    '• Cancel related TP/SL',
    '',
    '⚠️ This cannot be undone!'
  ];

  const message = createBox('Warning', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, Close', 'confirm_close'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
});

confirmClosePositionScene.action('confirm_close', async (ctx) => {
  await ctx.answerCbQuery('Closing position...');
  
  const exchange = ctx.session.activeExchange || 'aster';
  const symbol = ctx.session.tradingSymbol;
  const userId = ctx.from?.id?.toString();

  try {
    if (userId && symbol) {
        const { getOrCreateUser } = require('../../db/users');
        const { UniversalApiService } = require('../services/universal-api.service');
        // @ts-ignore
        const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
        const uid = user.id;

        await UniversalApiService.closePosition(uid, exchange, symbol);
        
        await ctx.reply(`✅ ${symbol} position closed successfully!`);
    } else {
        throw new Error('Missing symbol or user ID');
    }
  } catch (error: any) {
    console.error('Close position failed:', error);
    await ctx.reply(`❌ Failed to close position: ${error.message}`);
  }

  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

confirmClosePositionScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_with_open');
});

export default confirmClosePositionScene;
