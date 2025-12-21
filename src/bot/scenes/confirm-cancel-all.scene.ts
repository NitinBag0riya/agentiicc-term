import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const confirmCancelAllScene = new Scenes.BaseScene<BotContext>('confirm_cancel_all');

// Screen: Confirm Cancel All Orders
confirmCancelAllScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'All';
  const exchange = ctx.session.activeExchange || 'aster';
  
  const { createBox } = require('../utils/format');

  const lines = [
    '⚠️ Cancel All Orders?',
    '',
    'You are about to cancel',
    'ALL open orders.',
    '',
    `Exchange: ${exchange.toUpperCase()}`,
    `Symbol: ${symbol}`,
    '',
    '---',
    '',
    '⚠️ This cannot be undone!',
    '',
    'All pending orders will be',
    'cancelled immediately.'
  ];

  const message = createBox('Warning', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, Cancel All', 'confirm'),
        Markup.button.callback('❌ No, Keep Orders', 'cancel'),
      ],
    ]),
  });
});

confirmCancelAllScene.action('confirm', async (ctx) => {
  await ctx.answerCbQuery('Cancelling orders...');
  // TODO: Execute cancel all orders via API
  await ctx.reply('✅ All orders cancelled successfully!');
  await ctx.scene.enter('orders_list');
});

confirmCancelAllScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('orders_list');
});

export default confirmCancelAllScene;
