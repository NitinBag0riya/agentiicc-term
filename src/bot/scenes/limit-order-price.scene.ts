import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const limitOrderPriceScene = new Scenes.BaseScene<BotContext>('limit_order_price');

// Screen: Limit Order Price Input
limitOrderPriceScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  
  const { createBox } = require('../utils/format');

  const lines = [
    '💵 Enter Limit Price',
    '',
    `Symbol: ${symbol}`,
    `Side: ${side}`,
    `Amount: $${ctx.session.orderAmount || 50}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'Enter the price at which',
    'you want to execute:',
    '',
    '💡 Type price below',
    '   Example: 142.50'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  ctx.scene.session.state = { awaitingPrice: true };
});

limitOrderPriceScene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  if (state?.awaitingPrice) {
    const price = parseFloat(ctx.message.text.trim());
    
    if (isNaN(price) || price <= 0) {
      await ctx.reply('❌ Invalid price. Please enter a positive number.');
      return;
    }
    
    ctx.session.orderPrice = price;
    await ctx.scene.enter('confirm_order');
  }
});

limitOrderPriceScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default limitOrderPriceScene;
