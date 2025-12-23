/**
 * TP/SL Management Handlers
 *
 * Take Profit and Stop Loss handlers
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../../types/context';
import { getRedis } from '../../db/redis';
import { getPostgres } from '../../db/postgres';
import { UniversalApiClient } from '../../services/universalApi';
import { cleanupButtonMessages, trackButtonMessage } from '../../utils/buttonCleanup';

/**
 * Set Take Profit
 */
export function registerSetTPHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_set_tp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter TP price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_set_tp' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter Take Profit price or percentage:\n\nExamples:\n• `2.50` (price)\n• `10%` (10% profit)', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Set Stop Loss
 */
export function registerSetSLHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_set_sl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter SL price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_set_sl' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter Stop Loss price or percentage:\n\nExamples:\n• `1.50` (price)\n• `5%` (5% loss)', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Set Both TP and SL
 */
export function registerSetBothHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_set_both:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter TP and SL prices:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_set_both' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter TP and SL (space separated):\n\nExamples:\n• `2.50 1.50` (prices)\n• `10% 5%` (percentages)\n• `10% 1.50` (mixed)', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Modify Take Profit
 */
export function registerModifyTPHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_modify_tp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter new TP price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_modify_tp' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter new Take Profit (price or %):\n\nExamples: `2.50` or `10%`', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Modify Stop Loss
 */
export function registerModifySLHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_modify_sl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter new SL price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_modify_sl' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter new Stop Loss (price or %):\n\nExamples: `1.50` or `5%`', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}

/**
 * Remove Take Profit
 */
export function registerRemoveTPHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_remove_tp:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const orderId = parseInt(ctx.match[2]);

    if (!ctx.session.userId) return;

    try {
      const redis = getRedis();
      const db = getPostgres();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);

      const res = await client.cancelOrder(orderId.toString(), symbol);
      if (!res.success) throw new Error(res.error);

      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply(`✅ **Take Profit Removed - ${symbol}**`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    } catch (error) {
      console.error('[Remove TP] Error:', error);
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Failed to remove Take Profit', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    }
  });
}

/**
 * Remove Stop Loss
 */
export function registerRemoveSLHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_remove_sl:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const orderId = parseInt(ctx.match[2]);

    if (!ctx.session.userId) return;

    try {
      const redis = getRedis();
      const db = getPostgres();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);

      const res = await client.cancelOrder(orderId.toString(), symbol);
      if (!res.success) throw new Error(res.error);

      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply(`✅ **Stop Loss Removed - ${symbol}**`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    } catch (error) {
      console.error('[Remove SL] Error:', error);
      await cleanupButtonMessages(ctx);
      const sentMessage = await ctx.reply('❌ Failed to remove Stop Loss', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]]),
      });
      trackButtonMessage(ctx, sentMessage.message_id);
    }
  });
}
