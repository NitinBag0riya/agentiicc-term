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
    '👋 **Welcome to AgentiFi Trading Bot!**\n\n' +
    'Your gateway to multi-exchange perpetual futures trading.\n\n' +
    '**Supported Exchanges:**\n' +
    '⭐ Aster DEX\n' +
    '🌊 Hyperliquid\n\n' +
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
      '📋 **Main Menu**\n\n' +
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
    '📋 **Main Menu**\n\n' +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        // Row 1: Trading actions (3 buttons)
        [
          Markup.button.callback('💰 Balance', 'view_balance'),
          Markup.button.callback('📊 Positions', 'view_positions'),
          Markup.button.callback('📈 Trade', 'start_trade')
        ],
        // Row 2: Exchange & Settings (3 buttons)
        [
          Markup.button.callback('🔄 Switch', 'switch_exchange'),
          Markup.button.callback('⚙️ Settings', 'settings'),
          Markup.button.callback('❓ Help', 'help')
        ],
      ])
    }
  );
});

// Action handlers
mainMenuComposer.action('link_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('link');
});

mainMenuComposer.action('start_trade', async (ctx) => {
  await ctx.answerCbQuery();
  
  // Check if user is linked
  if (!ctx.session.isLinked || !ctx.session.activeExchange) {
    await ctx.reply('❌ Please link an exchange first using /link');
    return;
  }
  
  await ctx.scene.enter('trade');
});

mainMenuComposer.action('view_balance', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  const { formatAccountBalance, formatError } = await import('../utils/formatters');
  const { getExchangeEmoji, getExchangeName } = await import('../config');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    const exchangeId = ctx.session.activeExchange!;
    const emoji = getExchangeEmoji(exchangeId as any);
    const name = getExchangeName(exchangeId as any);

    console.log('[Balance] Fetching account for exchange:', exchangeId);
    const client = new UniversalApiClient(token);
    const account = await client.getAccount();
    console.log('[Balance] Account response:', JSON.stringify(account, null, 2));
    
    const balanceText = `💰 **Balance** | ${emoji} ${name}\n\n` + formatAccountBalance(account);
    await ctx.reply(balanceText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('[Balance] Error:', error);
    await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
  }
});

mainMenuComposer.action('view_positions', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  const { formatPositions, formatError } = await import('../utils/formatters');
  const { getExchangeEmoji, getExchangeName } = await import('../config');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    const exchangeId = ctx.session.activeExchange!;
    const emoji = getExchangeEmoji(exchangeId as any);
    const name = getExchangeName(exchangeId as any);

    console.log('[Positions] Fetching positions for exchange:', exchangeId);
    const client = new UniversalApiClient(token);
    const positions = await client.getPositions();
    console.log('[Positions] Positions response:', JSON.stringify(positions, null, 2));
    
    const positionsText = `📊 **Positions** | ${emoji} ${name}\n\n` + formatPositions(positions);
    
    // Add action buttons
    const buttons = [];
    
    // Row 1: Position actions (if has positions)
    if (positions && positions.length > 0) {
      buttons.push([
        Markup.button.callback('❌ Close Position', 'close_position'),
        Markup.button.callback('🔄 Refresh', 'view_positions')
      ]);
    } else {
      buttons.push([Markup.button.callback('🔄 Refresh', 'view_positions')]);
    }
    
    // Row 2: Order management
    buttons.push([
      Markup.button.callback('📋 Open Orders', 'view_orders'),
      Markup.button.callback('🚫 Cancel All', 'cancel_all_orders')
    ]);
    
    // Row 3: Navigation
    buttons.push([Markup.button.callback('🔙 Back', 'back_to_menu')]);
    
    await ctx.reply(positionsText, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } catch (error) {
    console.error('[Positions] Error:', error);
    await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
  }
});

mainMenuComposer.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { getAllUserExchanges } = await import('../../db/users');
  const { getExchangeEmoji, getExchangeName } = await import('../config');
  
  const userId = ctx.session.userId;
  const exchangeId = ctx.session.activeExchange;
  
  if (!userId || !exchangeId) {
    await ctx.reply('❌ Session error. Please /link again.');
    return;
  }

  // Get all linked exchanges
  const exchanges = await getAllUserExchanges(userId);
  const hasMultipleExchanges = exchanges.length > 1;
  
  const emoji = getExchangeEmoji(exchangeId as any);
  const name = getExchangeName(exchangeId as any);
  
  const buttons = [];
  
  // Add switch exchange button if multiple exchanges
  if (hasMultipleExchanges) {
    buttons.push([Markup.button.callback('🔄 Switch Exchange', 'switch_exchange')]);
  }
  
  buttons.push([Markup.button.callback('🔓 Unlink Exchange', 'unlink_exchange')]);
  buttons.push([Markup.button.callback('🔙 Back to Menu', 'back_to_menu')]);
  
  await ctx.reply(
    '⚙️ **Settings**\\n\\n' +
    `**Active Exchange:** ${emoji} ${name}\\n` +
    (hasMultipleExchanges ? `**Linked Exchanges:** ${exchanges.length}\\n\\n` : '\\n') +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
});


mainMenuComposer.action('switch_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('switch-exchange');
});

mainMenuComposer.action('unlink_exchange', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('unlink');
});

mainMenuComposer.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '📋 **Main Menu**\n\n' +
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
    '❓ **Help**\n\n' +
    '**Commands:**\n' +
    '/start - Start the bot\n' +
    '/menu - Show main menu\n' +
    '/link - Link exchange account\n' +
    '/unlink - Unlink exchange account\n\n' +
    '**Features:**\n' +
    '• Multi-exchange support (Aster DEX, Hyperliquid)\n' +
    '• View account balance\n' +
    '• View open positions\n' +
    '• Place market/limit orders\n' +
    '• Adjust leverage\n' +
    '• Manage margin\n\n' +
    '**Security:**\n' +
    '• All credentials are encrypted\n' +
    '• Secure API communication\n' +
    '• No credentials stored in plaintext',
    { parse_mode: 'Markdown' }
  );
});
