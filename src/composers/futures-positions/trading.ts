/**
 * Trade Execution Handlers
 *
 * ALL buttons launch wizards (with or without prefilled amounts)
 * Wizards handle input validation, confirmation, and return to State 2
 */
import { Composer } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { getAsterClientForUser } from '../../aster/helpers';

/**
 * Ape with fixed amount ($50, $200) - Launch wizard with prefilled amount
 */
export function registerApeHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_ape:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];

    if (!ctx.session.userId) return;

    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';


    // Launch wizard with prefilled amount
    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'BUY',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        prefilledAmount: `$${amount}`, // Prefill the amount
        retryCount: 0,
      }
    );
  });
}

/**
 * Ape Custom Amount (X) - Launch wizard based on toggle
 */
export function registerApeCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_ape_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const state = ctx.session.tradingState?.[symbol];

    // Use the toggle state to determine which wizard
    const isMarket = state?.orderType === 'Market';


    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'BUY',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        retryCount: 0,
      }
    );
  });
}

/**
 * Long with fixed amount ($50, $200) - Launch wizard with prefilled amount
 */
export function registerLongHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_long:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];

    if (!ctx.session.userId) return;

    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';


    // Launch wizard with prefilled amount
    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'BUY',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        prefilledAmount: `$${amount}`,
        retryCount: 0,
      }
    );
  });
}

/**
 * Long Custom Amount (X) - Launch wizard based on toggle
 */
export function registerLongCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_long_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const state = ctx.session.tradingState?.[symbol];

    const isMarket = state?.orderType === 'Market';


    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'BUY',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        retryCount: 0,
      }
    );
  });
}

/**
 * Short with fixed amount ($50, $200) - Launch wizard with prefilled amount
 */
export function registerShortHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_short:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];

    if (!ctx.session.userId) return;

    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';


    // Launch wizard with prefilled amount
    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'SELL',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        prefilledAmount: `$${amount}`,
        retryCount: 0,
      }
    );
  });
}

/**
 * Short Custom Amount (X) - Launch wizard based on toggle
 */
export function registerShortCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_short_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const state = ctx.session.tradingState?.[symbol];

    const isMarket = state?.orderType === 'Market';


    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'SELL',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: false,
        retryCount: 0,
      }
    );
  });
}

/**
 * Close position with percentage - Launch wizard with prefilled amount
 */
export function registerCloseHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_close:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const percentage = ctx.match[2];

    if (!ctx.session.userId) return;

    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';

    // Determine close side based on position direction
    // LONG (positive) → SELL to close
    // SHORT (negative) → BUY to close
    const redis = getRedis();
    const db = getPostgres();
    const client = await getAsterClientForUser(ctx.session.userId, db, redis);
    const positions = await client.getPositions();
    const position = positions.find(p => p.symbol === symbol && parseFloat(p.positionAmt) !== 0);

    const closeSide = position && parseFloat(position.positionAmt) < 0 ? 'BUY' : 'SELL';

    // Launch wizard with prefilled amount (percentage)
    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: closeSide,
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: true,
        prefilledAmount: `${percentage}%`,
        retryCount: 0,
      }
    );
  });
}

/**
 * Sell Custom Amount (X) - Launch wizard based on toggle
 */
export function registerSellCustomHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_sell_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const state = ctx.session.tradingState?.[symbol];

    const isMarket = state?.orderType === 'Market';


    await ctx.scene.enter(
      isMarket ? 'market-order-wizard' : 'limit-order-wizard',
      {
        symbol,
        side: 'SELL',
        leverage: state?.leverage,
        marginType: state?.marginType,
        reduceOnly: true,
        retryCount: 0,
      }
    );
  });
}
