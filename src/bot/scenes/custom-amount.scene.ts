import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const customAmountScene = new Scenes.BaseScene<BotContext>('custom_amount');

// Enter handler - Screen 36: Custom Amount
customAmountScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  
  const { createBox } = require('../utils/format');

  const lines = [
    '💵 Enter Custom Amount',
    '',
    `Symbol: ${symbol}`,
    `Side: ${side} ${sideEmoji}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'Enter amount in USDT:',
    '',
    'Examples:',
    '• 100 (for $100)',
    '• 500 (for $500)',
    '• 1000 (for $1000)',
    '',
    '💡 Type the amount below'
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
  
  ctx.scene.session.state = { awaitingAmount: true };
});

customAmountScene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  if (state?.awaitingAmount) {
    const amountText = ctx.message.text.trim();
    const amount = parseFloat(amountText);
    
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a positive number.');
      return;
    }
    
    ctx.session.orderAmount = amount;
    await ctx.scene.enter('confirm_order');
  }
});

customAmountScene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default customAmountScene;
