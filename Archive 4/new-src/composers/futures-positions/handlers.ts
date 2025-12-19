/**
 * Futures Position Management Handlers
 *
 * Toggle handlers, refresh, and list handlers
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { getAsterClientForUser } from '../../aster/helpers';
import { AsterDexError } from '../../aster/client';
import { buildPositionInterface, showPositionManagement } from './interface';
import { fetchPerpData } from '../overview-menu.composer';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';
import type { AsterWriteOp } from '../../aster/writeOps';

/**
 * Positions handler - Shows all futures positions
 * Uses the EXACT same function as overview, just without the 10-position limit
 */
export function registerPositionsListHandler(composer: Composer<BotContext>) {
  composer.action('positions', async (ctx) => {
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
      '⏳ **Loading futures positions...**',
      { parse_mode: 'Markdown' }
    );

    try {
      const redis = getRedis();
      const db = getPostgres();
      const client = await getAsterClientForUser(ctx.session.userId, db, redis);

      // Use the EXACT same function as overview, but with no limit (shows ALL positions)
      const perpData = await fetchPerpData(client, ctx); // No limit = show all

      // Edit the message with the data
      await ctx.editMessageText(perpData.message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'positions')],
          [Markup.button.callback('« Back', 'refresh_overview')],
        ]),
      });
    } catch (error: unknown) {
      console.error('[PositionsComposer] Error:', error);

      let errorMessage = '❌ **Failed to Load Positions**\n\n';

      if (error instanceof AsterDexError) {
        if (error.code === 'IP_BANNED') {
          errorMessage += '🚫 IP banned by AsterDex.';
        } else if (error.code === 'RATE_LIMITED') {
          errorMessage += `⏰ ${error.message}`;
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unexpected error occurred.';
      }

      await ctx.editMessageText(errorMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Retry', 'positions')],
          [Markup.button.callback('« Back', 'refresh_overview')],
        ]),
      });
    }
  });
}

/**
 * Toggle Order Type (Market <-> Limit)
 */
export function registerToggleOrderTypeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_toggle_ordertype:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    // Toggle order type
    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) {
      ctx.session.tradingState[symbol] = { orderType: 'Market', leverage: 5, marginType: 'cross' };
    }

    const currentType = ctx.session.tradingState[symbol].orderType;
    ctx.session.tradingState[symbol].orderType = currentType === 'Market' ? 'Limit' : 'Market';

    try {
      const { message, buttons } = await buildPositionInterface(ctx, symbol);
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      console.error('[Toggle Order Type] Error:', error);
    }
  });
}

/**
 * Toggle Margin Type (Cross <-> Isolated) - Shows confirmation with asset mode check
 */
export function registerToggleMarginHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_toggle_margin:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    const redis = getRedis();
    const db = getPostgres();

    try {
      // Get current margin type and asset mode from exchange
      const client = await getAsterClientForUser(ctx.session.userId, db, redis);
      const positions = await client.getPositions();
      const positionInfo = positions.find(p => p.symbol === symbol);

      // API returns lowercase (cross/isolated) but expects uppercase (CROSSED/ISOLATED) for params
      const apiMarginType = positionInfo?.marginType || 'cross'; // Keep as-is from API
      const currentMarginType = apiMarginType.toUpperCase() === 'CROSS' || apiMarginType.toUpperCase() === 'CROSSED' ? 'CROSSED' : 'ISOLATED';
      const newMarginType: 'ISOLATED' | 'CROSSED' = currentMarginType === 'CROSSED' ? 'ISOLATED' : 'CROSSED';

      // Check asset mode if switching to isolated
      if (newMarginType === 'ISOLATED') {
        const assetMode = await client.getMultiAssetsMargin();
        if (assetMode.multiAssetsMargin === true) {
          // Multi-Asset Mode is enabled - need Single-Asset Mode for isolated
          await cleanupButtonMessages(ctx);
          const sentMessage = await ctx.reply(
            `⚠️ **Cannot Use Isolated Margin**\n\n` +
            `Isolated margin requires **Single-Asset Mode**.\n\n` +
            `Your account is currently in **Multi-Asset Mode**.\n\n` +
            `To use isolated margin:\n` +
            `1. Go to /menu → Settings → Asset Mode\n` +
            `2. Switch to Single-Asset Mode\n` +
            `3. Return here and try again`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('⚙️ Go to Settings', 'settings_asset_mode')],
                [Markup.button.callback('📊 Back to Position', `pos_refresh:${symbol}`)],
              ]),
            }
          );
          trackButtonMessage(ctx, sentMessage.message_id);
          return;
        }
      }

      // Create SET_MARGIN_TYPE operation
      const operation: AsterWriteOp = {
        operation: 'SET_MARGIN_TYPE',
        params: {
          symbol,
          marginType: newMarginType, // Use uppercase for API call
        },
        metadata: {
          previousMarginType: apiMarginType, // Store as-is from API for display
        },
      };

      // Show confirmation
      const { showConfirmation } = await import('../../utils/confirmDialog');
      const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation, client);

      if (!operationId) {
        // Error was already handled in showConfirmation
        return;
      }

    } catch (error) {
      console.error('[Toggle Margin] Error:', error);

      let errorMessage = '❌ **Failed to Change Margin Type**\n\n';

      if (error instanceof Error) {
        errorMessage += `Error: ${error.message}\n\n`;
      }

      errorMessage += 'Please try again or contact support if the issue persists.';

      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply(errorMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📊 Back to Position', `pos_refresh:${symbol}`)],
          [Markup.button.callback('🏠 Back to Menu', 'menu')],
        ]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    }
  });
}

/**
 * Show Leverage Menu
 */
export function registerLeverageMenuHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_leverage_menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    const currentLeverage = ctx.session.tradingState?.[symbol]?.leverage || 5;

    const leverageOptions = [2, 5, 10, 20];
    const buttons = leverageOptions.map(lev => {
      const label = lev === currentLeverage ? `✅${lev}x` : `${lev}x`;
      return Markup.button.callback(label, `pos_set_leverage:${symbol}:${lev}`);
    });

    await ctx.editMessageReplyMarkup(
      Markup.inlineKeyboard([
        buttons.slice(0, 2),
        buttons.slice(2, 4),
        [Markup.button.callback('Custom', `pos_leverage_custom:${symbol}`)],
        [
          Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`),
          Markup.button.callback('⚙️ Default', `pos_default:${symbol}`),
        ],
      ]).reply_markup
    );
  });
}

/**
 * Set Leverage - Enter leverage wizard with preset value
 */
export function registerSetLeverageHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_set_leverage:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const leverage = parseInt(ctx.match[2]);

    if (!ctx.session.userId) return;

    const redis = getRedis();
    const db = getPostgres();

    try {
      // Get current leverage from exchange
      const client = await getAsterClientForUser(ctx.session.userId, db, redis);
      const positions = await client.getPositions();
      const positionInfo = positions.find(p => p.symbol === symbol);
      const currentLeverage = positionInfo ? parseInt(positionInfo.leverage) : 5;
      const hasOpenPosition = positionInfo && parseFloat(positionInfo.positionAmt) !== 0;

      // Enter wizard with state
      await ctx.scene.enter('leverage-wizard', {
        symbol,
        leverage, // Preset value
        currentLeverage,
        hasOpenPosition,
      });

    } catch (error) {
      console.error('[Set Leverage] Error:', error);
      await ctx.reply('❌ Failed to load leverage info. Please try again.');
    }
  });
}

/**
 * Custom Leverage Input - Enter wizard without preset
 */
export function registerLeverageCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_leverage_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter leverage (1-125):');
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    const redis = getRedis();
    const db = getPostgres();

    try {
      // Get current leverage from exchange
      const client = await getAsterClientForUser(ctx.session.userId, db, redis);
      const positions = await client.getPositions();
      const positionInfo = positions.find(p => p.symbol === symbol);
      const currentLeverage = positionInfo ? parseInt(positionInfo.leverage) : 5;
      const hasOpenPosition = positionInfo && parseFloat(positionInfo.positionAmt) !== 0;

      // Enter wizard without preset value
      await ctx.scene.enter('leverage-wizard', {
        symbol,
        currentLeverage,
        hasOpenPosition,
      });

    } catch (error) {
      console.error('[Custom Leverage] Error:', error);
      await ctx.reply('❌ Failed to load leverage info. Please try again.');
    }
  });
}

/**
 * Margin Management - Enter margin wizard for isolated positions
 */
export function registerMarginManagementHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_margin:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    try {
      // Enter margin wizard
      await ctx.scene.enter('margin-wizard', {
        symbol,
      });

    } catch (error) {
      console.error('[Margin Management] Error:', error);
      await ctx.reply('❌ Failed to open margin management. Please try again.');
    }
  });
}

/**
 * Refresh Position
 */
export function registerRefreshHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_refresh:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    // Check if user is canceling from input prompt
    if (ctx.session.waitingForInput?.symbol === symbol) {
      // Clear waiting state
      ctx.session.waitingForInput = undefined;

      // Send cancellation message (new message)
      await ctx.reply('❌ Cancelled', {
        parse_mode: 'Markdown',
      });

      // Show position management (new message)
      await showPositionManagement(ctx, symbol, false); // Edit = false (new message)
      return;
    }

    // Normal refresh - edit existing message
    await showPositionManagement(ctx, symbol, true); // Edit = true
  });
}

/**
 * Default Settings (placeholder)
 */
export function registerDefaultSettingsHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_default:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Default settings coming later!');
  });
}

/**
 * TP/SL Mode - Switch to TP/SL buttons
 */
export function registerTPSLModeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_mode:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    try {
      const { buildTPSLButtons } = await import('./interface');
      const buttons = await buildTPSLButtons(ctx, symbol);
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (messageId) {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat!.id,
          messageId,
          undefined,
          Markup.inlineKeyboard(buttons).reply_markup
        );
      }
    } catch (error) {
      console.error('[TP/SL Mode] Error:', error);
      await ctx.answerCbQuery('Failed to switch to TP/SL mode');
    }
  });
}

/**
 * Orders Mode - Switch to orders buttons
 */
export function registerOrdersModeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_orders_mode:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    if (!ctx.session.userId) return;

    try {
      const { buildOrdersButtons } = await import('./interface');
      const buttons = await buildOrdersButtons(ctx, symbol);
      const messageId = ctx.callbackQuery?.message?.message_id;

      if (messageId) {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat!.id,
          messageId,
          undefined,
          Markup.inlineKeyboard(buttons).reply_markup
        );
      }
    } catch (error) {
      console.error('[Orders Mode] Error:', error);
      await ctx.answerCbQuery('Failed to switch to orders mode');
    }
  });
}
