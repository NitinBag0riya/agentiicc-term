/**
 * TP/SL Composer - Take Profit and Stop Loss Management
 * 
 * Ported from legacy futures-positions/tpsl.ts
 * Provides handlers for setting, modifying, and removing TP/SL orders
 */

import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';
import { showPositionMenu } from './position.composer';

export const tpslComposer = new Composer<BotContext>();

/**
 * Build TP/SL mode buttons based on existing orders
 */
export async function buildTPSLButtons(ctx: BotContext, symbol: string) {
    const { authToken, activeExchange } = ctx.session;

    let tpOrder: any = null;
    let slOrder: any = null;

    if (authToken) {
        try {
            const ordersRes = await ApiClient.getOpenOrders(authToken, symbol);
            if (ordersRes.success && ordersRes.data) {
                const orders = ordersRes.data;
                // Identify TP/SL orders
                tpOrder = orders.find((o: any) =>
                    o.type?.includes('TAKE_PROFIT') ||
                    (o.reduceOnly && o.side === 'SELL' && parseFloat(o.stopPrice || o.price) > 0)
                );
                slOrder = orders.find((o: any) =>
                    (o.type?.includes('STOP') && !o.type?.includes('TAKE_PROFIT')) ||
                    o.type === 'STOP_MARKET' || o.type === 'STOP_LIMIT'
                );
            }
        } catch (e) { /* Ignore */ }
    }

    const buttons: any[][] = [];

    if (tpOrder && slOrder) {
        // Both exist - show modify/remove options
        buttons.push([
            Markup.button.callback('✏️ Modify TP', `pos_tpsl_modify_tp:${symbol}`),
            Markup.button.callback('✏️ Modify SL', `pos_tpsl_modify_sl:${symbol}`)
        ]);
        buttons.push([
            Markup.button.callback('❌ Remove TP', `pos_tpsl_remove_tp:${symbol}:${tpOrder.orderId}`),
            Markup.button.callback('❌ Remove SL', `pos_tpsl_remove_sl:${symbol}:${slOrder.orderId}`)
        ]);
    } else if (tpOrder) {
        // Only TP exists
        buttons.push([
            Markup.button.callback('➕ Set SL', `pos_tpsl_set_sl:${symbol}`),
            Markup.button.callback('✏️ Modify TP', `pos_tpsl_modify_tp:${symbol}`)
        ]);
        buttons.push([
            Markup.button.callback('❌ Remove TP', `pos_tpsl_remove_tp:${symbol}:${tpOrder.orderId}`)
        ]);
    } else if (slOrder) {
        // Only SL exists
        buttons.push([
            Markup.button.callback('➕ Set TP', `pos_tpsl_set_tp:${symbol}`),
            Markup.button.callback('✏️ Modify SL', `pos_tpsl_modify_sl:${symbol}`)
        ]);
        buttons.push([
            Markup.button.callback('❌ Remove SL', `pos_tpsl_remove_sl:${symbol}:${slOrder.orderId}`)
        ]);
    } else {
        // Neither exists - show set options
        buttons.push([
            Markup.button.callback('🎯 Set TP', `pos_tpsl_set_tp:${symbol}`),
            Markup.button.callback('🛑 Set SL', `pos_tpsl_set_sl:${symbol}`)
        ]);
        buttons.push([
            Markup.button.callback('🎯🛑 Set Both', `pos_tpsl_set_both:${symbol}`)
        ]);
    }

    buttons.push([
        Markup.button.callback('« Back', `pos_refresh:${symbol}`)
    ]);

    return buttons;
}

// ==================== Set TP Handler ====================
tpslComposer.action(/^pos_tpsl_set_tp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter TP price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
        action: 'tpsl_set_tp',
        symbol
    };

    await ctx.reply(
        `🎯 **Set Take Profit - ${symbol}**\n\n` +
        `Enter price or percentage:\n\n` +
        `Examples:\n` +
        `• \`2.50\` (price)\n` +
        `• \`10%\` (10% profit from entry)`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]])
        }
    );
});

// ==================== Set SL Handler ====================
tpslComposer.action(/^pos_tpsl_set_sl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter SL price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
        action: 'tpsl_set_sl',
        symbol
    };

    await ctx.reply(
        `🛑 **Set Stop Loss - ${symbol}**\n\n` +
        `Enter price or percentage:\n\n` +
        `Examples:\n` +
        `• \`1.50\` (price)\n` +
        `• \`5%\` (5% loss from entry)`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]])
        }
    );
});

// ==================== Set Both Handler ====================
tpslComposer.action(/^pos_tpsl_set_both:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter TP and SL:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
        action: 'tpsl_set_both',
        symbol
    };

    await ctx.reply(
        `🎯🛑 **Set TP & SL - ${symbol}**\n\n` +
        `Enter TP and SL (space separated):\n\n` +
        `Examples:\n` +
        `• \`2.50 1.50\` (prices)\n` +
        `• \`10% 5%\` (percentages)\n` +
        `• \`10% 1.50\` (mixed)`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]])
        }
    );
});

// ==================== Modify TP Handler ====================
tpslComposer.action(/^pos_tpsl_modify_tp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter new TP price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
        action: 'tpsl_modify_tp',
        symbol
    };

    await ctx.reply(
        `✏️ **Modify Take Profit - ${symbol}**\n\n` +
        `Enter new price or percentage:\n\n` +
        `Examples: \`2.50\` or \`10%\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]])
        }
    );
});

// ==================== Modify SL Handler ====================
tpslComposer.action(/^pos_tpsl_modify_sl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Enter new SL price:');
    const symbol = ctx.match[1];

    ctx.session.waitingForInput = {
        action: 'tpsl_modify_sl',
        symbol
    };

    await ctx.reply(
        `✏️ **Modify Stop Loss - ${symbol}**\n\n` +
        `Enter new price or percentage:\n\n` +
        `Examples: \`1.50\` or \`5%\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', `pos_refresh:${symbol}`)]])
        }
    );
});

// ==================== Remove TP Handler ====================
tpslComposer.action(/^pos_tpsl_remove_tp:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Removing TP...');
    const symbol = ctx.match[1];
    const orderId = ctx.match[2];
    const { authToken } = ctx.session;

    if (!authToken) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    try {
        const res = await ApiClient.cancelOrder(authToken, orderId, symbol);

        if (res.success) {
            await ctx.reply(`✅ **Take Profit Removed - ${symbol}**`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]])
            });
        } else {
            throw new Error(res.error || 'Failed to cancel order');
        }
    } catch (e: any) {
        await ctx.reply(`❌ Failed to remove TP: ${e.message}`, {
            ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]])
        });
    }
});

// ==================== Remove SL Handler ====================
tpslComposer.action(/^pos_tpsl_remove_sl:(.+):(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Removing SL...');
    const symbol = ctx.match[1];
    const orderId = ctx.match[2];
    const { authToken } = ctx.session;

    if (!authToken) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    try {
        const res = await ApiClient.cancelOrder(authToken, orderId, symbol);

        if (res.success) {
            await ctx.reply(`✅ **Stop Loss Removed - ${symbol}**`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]])
            });
        } else {
            throw new Error(res.error || 'Failed to cancel order');
        }
    } catch (e: any) {
        await ctx.reply(`❌ Failed to remove SL: ${e.message}`, {
            ...Markup.inlineKeyboard([[Markup.button.callback('« Back', `pos_refresh:${symbol}`)]])
        });
    }
});

// ==================== Text Input Handler for TP/SL ====================
tpslComposer.on('text', async (ctx, next) => {
    const waiting = ctx.session.waitingForInput;
    if (!waiting || !waiting.action?.startsWith('tpsl_')) {
        return next();
    }

    const { action, symbol } = waiting;
    const { authToken, activeExchange } = ctx.session;
    const input = ctx.message.text.trim();

    // Clear waiting state
    ctx.session.waitingForInput = undefined;

    if (!authToken || !symbol) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    try {
        const params: any = {
            exchange: activeExchange,
            symbol
        };

        if (action === 'tpsl_set_both') {
            // Parse two values
            const parts = input.split(/\s+/);
            if (parts.length !== 2) {
                await ctx.reply('❌ Please enter two values separated by space (TP SL).');
                return;
            }
            params.tp = parts[0];
            params.sl = parts[1];
        } else if (action === 'tpsl_set_tp' || action === 'tpsl_modify_tp') {
            params.tp = input;
        } else if (action === 'tpsl_set_sl' || action === 'tpsl_modify_sl') {
            params.sl = input;
        }

        await ctx.reply('⏳ Setting order...');

        const res = await ApiClient.setTpSl(authToken, params);

        if (res.success) {
            const type = params.tp && params.sl ? 'TP & SL' : (params.tp ? 'TP' : 'SL');
            await ctx.reply(`✅ **${type} Set Successfully!**\n\nSymbol: ${symbol}`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('📊 View Position', `pos_refresh:${symbol}`)]])
            });
        } else {
            throw new Error(res.error || 'Failed to set order');
        }
    } catch (e: any) {
        await ctx.reply(`❌ **Failed to Set Order**\n\nError: ${e.message}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Try Again', `pos_tpsl_mode:${symbol}`)]])
        });
    }
});
