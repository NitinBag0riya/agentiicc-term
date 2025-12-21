import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const linkWizardHyperliquidStep2Scene = new Scenes.BaseScene<BotContext>('link_wizard_hyperliquid_step2');

// Enter handler - Screen 11: Hyperliquid API Key
linkWizardHyperliquidStep2Scene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  const lines = [
    '🔑 Hyperliquid API Key',
    '',
    'Step 2: Enter your API Key',
    '',
    '📝 This is sensitive data',
    '    handle with care',
    '',
    '💡 Find this in:',
    'Settings > API Keys >',
    'Create New Key',
    '',
    'Required permissions:',
    '• Read account info',
    '• Place orders',
    '• Read positions'
  ];

  const message = createBox('API Key', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Type API key', 'type_api_key'),
        Markup.button.callback('🔙 Back', 'back'),
        Markup.button.callback('❌ Cancel', 'cancel'),
      ],
    ]),
  });
  
  ctx.scene.session.state = { awaitingApiKey: true, exchange: 'hyperliquid' };
});

linkWizardHyperliquidStep2Scene.on('text', async (ctx) => {
  const state = ctx.scene.session.state as any;
  if (state?.awaitingApiKey) {
    const apiKey = ctx.message.text.trim();
    ctx.session.tempApiKey = apiKey;
    await ctx.scene.enter('validating_hyperliquid');
  }
});

linkWizardHyperliquidStep2Scene.action('type_api_key', async (ctx) => {
  await ctx.answerCbQuery('Please type your API key below');
});

linkWizardHyperliquidStep2Scene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link_wizard_hyperliquid_step1');
});

linkWizardHyperliquidStep2Scene.action('cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default linkWizardHyperliquidStep2Scene;
