import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const linkWizardAsterStep2Scene = new Scenes.BaseScene<BotContext>('link_wizard_aster_step2');

// Enter handler - Aster API Secret Step 2
linkWizardAsterStep2Scene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔑 Aster DEX API Secret',
    '',
    'Step 2: Enter your API',
    'Secret',
    '',
    '⚠️  Security Notice:',
    '• Your secret is encrypted',
    '  with AES-256',
    '• Stored securely in our',
    '  database',
    '• Never transmitted in',
    '  plain text',
    '• Only used for authorized',
    '  trades'
  ];

  const message = createBox('API Secret', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔙 Back', 'back'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  ctx.scene.session.state = { awaitingApiSecret: true, exchange: 'aster' };
});

linkWizardAsterStep2Scene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  if (state?.awaitingApiSecret) {
    const apiSecret = ctx.message.text.trim();
    
    // Basic validation
    if (apiSecret.length < 10) {
      await ctx.reply('❌ Invalid API secret format. Please enter a valid API secret.');
      return;
    }
    
    ctx.session.tempApiSecret = apiSecret;
    await ctx.scene.enter('validating_aster');
  }
});

linkWizardAsterStep2Scene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_aster_step1');
});

linkWizardAsterStep2Scene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default linkWizardAsterStep2Scene;

