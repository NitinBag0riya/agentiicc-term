/**
 * Spot Assets Composer
 *
 * Handles all spot asset viewing and management
 * Uses the EXACT same function as overview menu, just without the 10-asset limit
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { UniversalApiClient } from '../../services/universalApi';
import { fetchSpotData } from '../overview-menu.composer';

export const spotAssetsComposer = new Composer<BotContext>();

/**
 * Main balance handler - Shows all spot assets
 * Uses the EXACT same function as overview, just without the 10-asset limit
 */
spotAssetsComposer.action('balance', async (ctx) => {
  await ctx.answerCbQuery('🔄 Loading...');

  // Check if linked
  if (!ctx.session.isLinked || !ctx.session.userId) {
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
    const redis = getRedis();
    const db = getPostgres();
    const client = new UniversalApiClient();
    await client.initSession(ctx.session.userId);

    // Use the EXACT same function as overview, but with no limit (shows ALL assets)
    const spotData = await fetchSpotData(client, ctx); // No limit = show all

    // Edit the message with the data
    await ctx.editMessageText(spotData.message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'balance')],
        [Markup.button.callback('« Back', 'refresh_overview')],
      ]),
    });
  } catch (error: unknown) {
    console.error('[BalanceComposer] Error:', error);

    let errorMessage = '❌ **Failed to Load Spot Assets**\n\n';

    if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unexpected error occurred.';
    }

    await ctx.editMessageText(errorMessage, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Retry', 'balance')],
        [Markup.button.callback('« Back', 'refresh_overview')],
      ]),
    });
  }
});

