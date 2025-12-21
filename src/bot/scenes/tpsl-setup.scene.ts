import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const tpslSetupScene = new Scenes.BaseScene<BotContext>('tpsl_setup');

// Enter handler - Screen 40: TPSL Setup
tpslSetupScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  
  const { createBox } = require('../utils/format');

  const lines = [
    '🎯 Set TP/SL',
    '',
    `Symbol: ${symbol}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    'Take Profit (TP):',
    'Set the price to close',
    'position with profit',
    '',
    'Stop Loss (SL):',
    'Set the price to close',
    'position to limit loss',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '💡 Type TP price first,',
    '   then SL price'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🎯 Set TP', 'set_tp'),
        Markup.button.callback('🛡️ Set SL', 'set_sl'),
      ],
      [
        Markup.button.callback('✅ Apply to Position', 'apply_position'),
        Markup.button.callback('💾 Save for Next Order', 'save_next'),
      ],
      [
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

tpslSetupScene.action('set_tp', async (ctx) => {
  await ctx.answerCbQuery('Enter TP price in the chat');
  ctx.scene.session.state = { awaitingTP: true };
  await ctx.reply('💡 Type your Take Profit price:');
});

tpslSetupScene.action('set_sl', async (ctx) => {
  await ctx.answerCbQuery('Enter SL price in the chat');
  ctx.scene.session.state = { awaitingSL: true };
  await ctx.reply('💡 Type your Stop Loss price:');
});

tpslSetupScene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  const price = parseFloat(ctx.message.text.trim());
  
  if (isNaN(price) || price <= 0) {
    await ctx.reply('❌ Invalid price. Please enter a positive number.');
    return;
  }
  
  if (state?.awaitingTP) {
    ctx.session.tpPrice = price;
    await ctx.reply(`✅ Take Profit set at $${price}`);
    ctx.scene.session.state = {};
  } else if (state?.awaitingSL) {
    ctx.session.slPrice = price;
    await ctx.reply(`✅ Stop Loss set at $${price}`);
    ctx.scene.session.state = {};
  }
  
  await ctx.scene.reenter();
});

tpslSetupScene.action('apply_position', async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const symbol = ctx.session.tradingSymbol;
  const userId = ctx.from?.id?.toString();
  const tp = ctx.session.tpPrice;
  const sl = ctx.session.slPrice;

  await ctx.answerCbQuery('Applying TP/SL...');

  try {
    if (userId && symbol) {
      const { getOrCreateUser } = require('../../db/users');
      const { UniversalApiService } = require('../services/universal-api.service');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      
      const result = await UniversalApiService.setPositionTPSL(
        user.id, 
        exchange, 
        symbol, 
        tp?.toString(), 
        sl?.toString()
      );
      
      if (result.success) {
        await ctx.reply(`✅ TP/SL applied to ${symbol} position!`);
      } else {
         await ctx.reply(`⚠️ ${result.message}`);
      }
    }
  } catch (error: any) {
    await ctx.reply(`❌ Failed to apply: ${error.message}`);
  }

  // Go back to position view
  await ctx.scene.enter('position_with_open');
});

tpslSetupScene.action('save_next', async (ctx) => {
  await ctx.answerCbQuery('Saved for next order');
  await ctx.scene.enter('position_no_open');
});

tpslSetupScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  // Smart back navigation
  if (ctx.session.tpPrice || ctx.session.slPrice) {
     // If set, assume we might be in position flow
     // But safer to check context? For now default to no_open as safe bet or prompt?
     // Let's try to infer: check if we have open position data cached?
     // Simple fallback:
     await ctx.scene.enter('position_no_open');
  } else {
     await ctx.scene.enter('position_no_open');
  }
});

export default tpslSetupScene;
