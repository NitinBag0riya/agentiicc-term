/**
 * Main Menu Composer
 */

import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const mainMenuComposer = new Composer<BotContext>();

mainMenuComposer.command('start', async (ctx) => {
  const { getOrCreateUser } = await import('../../db/users');
  
  if (ctx.from) {
    const user = await getOrCreateUser(ctx.from.id, ctx.from.username);
    ctx.session.userId = user.id;
    ctx.session.telegramId = ctx.from.id;
    ctx.session.username = ctx.from.username;
  }

  await ctx.reply(
    '👋 **Welcome to AgentiFi Trading Bot!**\\n\\n' +
    'Your gateway to multi-exchange perpetual futures trading.\\n\\n' +
    '**Supported Exchanges:**\\n' +
    '⭐ Aster DEX\\n' +
    '🌊 Hyperliquid\\n\\n' +
    'Get started by linking your exchange account!',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔗 Link Exchange', 'link_exchange')],
        [Markup.button.callback('❓ Help', 'help')],
      ])
    }
  );
});

mainMenuComposer.command('menu', async (ctx) => {
  if (!ctx.session.isLinked) {
    await ctx.reply(
      '📋 **Main Menu**\\n\\n' +
      'You need to link an exchange first!',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔗 Link Exchange', 'link_exchange')],
          [Markup.button.callback('❓ Help', 'help')],
        ])
      }
    );
    return;
  }

  await ctx.reply(
    '📋 **Main Menu**\\n\\n' +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💰 Balance', 'view_balance')],
        [Markup.button.callback('📊 Positions', 'view_positions')],
        [Markup.button.callback('⚙️ Settings', 'settings')],
        [Markup.button.callback('❓ Help', 'help')],
      ])
    }
  );
});

// Action handlers
mainMenuComposer.action('link_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link');
});

mainMenuComposer.action('view_balance', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  const { formatAccountBalance, formatError } = await import('../utils/formatters');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    const client = new UniversalApiClient(token);
    const account = await client.getAccount();
    
    await ctx.reply(formatAccountBalance(account), { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
  }
});

mainMenuComposer.action('view_positions', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  const { formatPositions, formatError } = await import('../utils/formatters');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    const client = new UniversalApiClient(token);
    const positions = await client.getPositions();
    
    await ctx.reply(formatPositions(positions), { parse_mode: 'Markdown' });
  } catch (error) {
    await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
  }
});

mainMenuComposer.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  
  const exchangeName = ctx.session.activeExchange || 'None';
  
  await ctx.reply(
    '⚙️ **Settings**\\n\\n' +
    `**Active Exchange:** ${exchangeName}\\n\\n` +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔓 Unlink Exchange', 'unlink_exchange')],
        [Markup.button.callback('🔙 Back to Menu', 'back_to_menu')],
      ])
    }
  );
});

mainMenuComposer.action('unlink_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('unlink');
});

mainMenuComposer.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '📋 **Main Menu**\\n\\n' +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('💰 Balance', 'view_balance')],
        [Markup.button.callback('📊 Positions', 'view_positions')],
        [Markup.button.callback('⚙️ Settings', 'settings')],
        [Markup.button.callback('❓ Help', 'help')],
      ])
    }
  );
});

mainMenuComposer.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.reply(
    '❓ **Help**\\n\\n' +
    '**Commands:**\\n' +
    '/start - Start the bot\\n' +
    '/menu - Show main menu\\n' +
    '/link - Link exchange account\\n' +
    '/unlink - Unlink exchange account\\n\\n' +
    '**Features:**\\n' +
    '• Multi-exchange support (Aster DEX, Hyperliquid)\\n' +
    '• View account balance\\n' +
    '• View open positions\\n' +
    '• Place market/limit orders\\n' +
    '• Adjust leverage\\n' +
    '• Manage margin\\n\\n' +
    '**Security:**\\n' +
    '• All credentials are encrypted\\n' +
    '• Secure API communication\\n' +
    '• No credentials stored in plaintext',
    { parse_mode: 'Markdown' }
  );
});
