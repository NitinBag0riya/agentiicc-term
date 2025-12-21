import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const linkWizardAsterStep1Scene = new Scenes.BaseScene<BotContext>('link_wizard_aster_step1');

// Enter handler - Aster API Key Step 1
linkWizardAsterStep1Scene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔗 Aster DEX API Setup',
    '   Step 1: Enter your API Key',
    '',
    '📝 Find this in:',
    'Aster DEX → Settings →',
    'API Keys → Create New Key',
    '',
    'Required permissions:',
    '• Read account info',
    '• Place orders',
    '• Read positions',
    '',
    '🔒 This will be encrypted',
    '   and stored securely'
  ];

  const message = createBox('API Setup', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔙 Back', 'back'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  ctx.scene.session.state = { awaitingApiKey: true, exchange: 'aster' };
});

// Handle text input for API key
linkWizardAsterStep1Scene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  
  if (state?.awaitingApiKey) {
    const apiKey = ctx.message.text.trim();
    
    // Basic validation
    if (apiKey.length < 10) {
      await ctx.reply('❌ Invalid API key format. Please enter a valid API key.');
      return;
    }
    
    // Store API key in session
    ctx.session.tempApiKey = apiKey;
    
    // Navigate to Step 2 (API Secret)
    await ctx.scene.enter('link_wizard_aster_step2');
  }
});

// CTA: Back → Exchange Selection Aster
linkWizardAsterStep1Scene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('exchange_selection_aster');
});

// CTA: Cancel → Universal Citadel
linkWizardAsterStep1Scene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default linkWizardAsterStep1Scene;

