import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const tpslSetupScene = new Scenes.BaseScene<BotContext>('tpsl_setup');

// Enter handler - Screen 40: TPSL Setup
tpslSetupScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  
  const message = `┌─────────────────────────────┐
│ 🎯 Set TP/SL                │
│                             │
│ Symbol: ${symbol}            │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Take Profit (TP):           │
│ Set the price to close      │
│ position with profit        │
│                             │
│ Stop Loss (SL):             │
│ Set the price to close      │
│ position to limit loss      │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💡 Type TP price first,     │
│    then SL price            │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🎯 Set TP', 'set_tp'),
        Markup.button.callback('🛡️ Set SL', 'set_sl'),
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

tpslSetupScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default tpslSetupScene;
