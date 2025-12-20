import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../../types/context';
import { UniversalApiService } from '../../services/universal-api.service';
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
 * Remove Take Profit
 */
export function registerRemoveTPHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_remove_tp:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Removing TP...');
    const symbol = ctx.match[1];
    const orderId = ctx.match[2];
    const activeExchange = ctx.session.activeExchange || 'aster';

    try {
      await UniversalApiService.cancelOrder(ctx.session.userId!.toString(), activeExchange, orderId);
      await ctx.reply(`✅ Take Profit removed for ${symbol}.`);
      const { showPositionManagement } = await import('./interface');
      await showPositionManagement(ctx, symbol, false);
    } catch (error: any) {
      await ctx.reply(`❌ Failed to remove TP: ${error.message}`);
    }
  });
}

/**
 * Remove Stop Loss
 */
export function registerRemoveSLHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_remove_sl:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Removing SL...');
    const symbol = ctx.match[1];
    const orderId = ctx.match[2];
    const activeExchange = ctx.session.activeExchange || 'aster';

    try {
      await UniversalApiService.cancelOrder(ctx.session.userId!.toString(), activeExchange, orderId);
      await ctx.reply(`✅ Stop Loss removed for ${symbol}.`);
      const { showPositionManagement } = await import('./interface');
      await showPositionManagement(ctx, symbol, false);
    } catch (error: any) {
      await ctx.reply(`❌ Failed to remove SL: ${error.message}`);
    }
  });
}

/**
 * Modify Take Profit
 */
export function registerModifyTPHandler(composer: Composer<BotContext>) {
  composer.action(/^pos_tpsl_modify_tp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Modify TP:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_modify_tp' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter new Take Profit price or percentage:\n\nExamples:\n• `2.50` (price)\n• `10%` (10% profit)', {
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
    await ctx.answerCbQuery('Modify SL:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_modify_sl' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter new Stop Loss price or percentage:\n\nExamples:\n• `1.50` (price)\n• `5%` (5% loss)', {
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
    await ctx.answerCbQuery('Enter TP and SL:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
      action: 'tpsl_set_both' as any,
      symbol,
    };

    await cleanupButtonMessages(ctx);
    const sentMessage = await ctx.reply('Enter Take Profit and Stop Loss separated by space:\n\nExamples:\n• `2.50 1.50` (prices)\n• `10% 5%` (percentages)', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]]),
    });
    trackButtonMessage(ctx, sentMessage.message_id);
  });
}
