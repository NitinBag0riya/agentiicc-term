/**
 * Spot Assets Composer
 *
 * Handles all spot asset viewing and management
 * Uses the EXACT same function as overview menu, just without the 10-asset limit
 */
import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../../types/context';
import { UniversalApiService } from '../../services/universal-api.service';

export const spotAssetsComposer = new Composer<BotContext>();

/**
 * Main balance handler - Shows all spot assets
 */
spotAssetsComposer.action('balance', async (ctx) => {
  await ctx.answerCbQuery('🔄 Loading...');

  const userId = ctx.session.userId?.toString();
  const exchange = ctx.session.activeExchange;

  if (!userId || !exchange) {
    await ctx.editMessageText(
      '❌ You need to link your API first.\n\nUse /link to get started.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'refresh_overview')]]),
      }
    );
    return;
  }

  // Show loading state
  await ctx.editMessageText(
    '⏳ **Loading spot assets...**',
    { parse_mode: 'Markdown' }
  );

  try {
    const accountInfo = await UniversalApiService.getAccount(userId, exchange);
    
    // Check if account data is available
    if (!accountInfo || !accountInfo.totalBalance) {
      await ctx.editMessageText(
        '⚠️ **Account data not available**\n\nPlease link your exchange account first using /link',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'refresh_overview')]]),
        }
      );
      return;
    }
    
    // Format the message
    let message = `💰 **${exchange.toUpperCase()} Wallets**\n\n`;
    message += `Total Balance: $${parseFloat(accountInfo.totalBalance).toFixed(2)}\n`;
    message += `Available: $${parseFloat(accountInfo.availableBalance).toFixed(2)}\n\n`;

    if (accountInfo.assets && accountInfo.assets.length > 0) {
      message += `📊 **Assets:**\n`;
      accountInfo.assets.forEach((asset: any) => {
        message += `• ${asset.symbol}: ${asset.total} ($${parseFloat(asset.valueUsd).toFixed(2)})\n`;
      });
    }

    // Edit the message with the data
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'balance')],
        [Markup.button.callback('« Back', 'refresh_overview')],
      ]),
    });
  } catch (error: any) {
    console.error('[BalanceComposer] Error:', error);

    await ctx.editMessageText(
      `❌ **Failed to Load Spot Assets**\n\n${error.message || 'Unexpected error occurred.'}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Retry', 'balance')],
          [Markup.button.callback('« Back', 'refresh_overview')],
        ]),
      }
    );
  }
});

