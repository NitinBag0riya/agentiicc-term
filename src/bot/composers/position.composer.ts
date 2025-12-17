/**
 * Position Composer - Ported from Legacy
 *
 * Handles position menu display and trading actions
 * Callback patterns match legacy format for consistency
 */

import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

export const positionComposer = new Composer<BotContext>();

// ==================== UI Builder ====================

async function buildPositionInterface(ctx: BotContext, symbol: string, position: any | null) {
    const { activeExchange, authToken } = ctx.session;
    const baseAsset = symbol.replace(/USDT$|USD$|PERP$/, '');

    // Initialize State
    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) {
        ctx.session.tradingState[symbol] = {
            orderType: 'Market',
            leverage: position ? parseInt(position.leverage) : 5,
            marginType: position ? position.marginType : 'Cross'
        };
    }
    const state = ctx.session.tradingState[symbol];

    // Sync state from position
    if (position) {
        state.leverage = parseInt(position.leverage);
        state.marginType = position.marginType;
    }

    // Fetch Ticker Data
    let ticker: any = null;
    if (authToken) {
        try {
            const res = await ApiClient.getTicker(authToken, symbol, activeExchange);
            if (res.success) ticker = res.data;
        } catch (e) { }
    }

    // Format ticker data
    const price = ticker ? parseFloat(ticker.price).toFixed(4) : '0.0000';
    const changePct = ticker ? parseFloat(ticker.change24h).toFixed(2) : '0.00';
    const high = ticker ? parseFloat(ticker.high24h).toFixed(4) : '0.0000';
    const low = ticker ? parseFloat(ticker.low24h).toFixed(4) : '0.0000';
    const volVal = ticker ? parseFloat(ticker.volume24h) : 0;
    const volStr = (volVal / 1000000).toFixed(2) + 'M';
    const isPos = parseFloat(changePct) >= 0;
    const sign = isPos ? '+' : '';
    const emoji = isPos ? '📈' : '📉';

    let message = '';
    const buttons: any[][] = [];

    if (!position) {
        // ================= NO POSITION (NEW ORDER) =================
        const orderType = state.orderType || 'Market';
        const leverage = state.leverage || 5;
        const marginType = state.marginType || 'Cross';

        message = `⚡ <b>${symbol} - New Position</b>\n\n`;
        message += `${emoji} Price: $${price}\n`;
        message += `24h Change: ${sign}${changePct}%\n`;
        message += `24h High/Low: $${high} / $${low}\n`;
        message += `24h Volume: ${volStr} USDT\n\n`;

        message += `⚙️ <b>Trading Settings</b>\n`;
        message += `• Order Type: ${orderType}\n`;
        message += `• Leverage: ${leverage}x\n`;
        message += `• Margin: ${marginType}\n\n`;

        message += `<i>Ready to open a position?</i>\n`;

        // Row 1: Settings (legacy pattern: pos_toggle_ordertype:SYMBOL)
        buttons.push([
            Markup.button.callback(`🔄 ${orderType}`, `pos_toggle_ordertype:${symbol}`),
            Markup.button.callback(`${leverage}x`, `pos_leverage_menu:${symbol}`),
            Markup.button.callback(`🔄 ${marginType}`, `pos_toggle_margin:${symbol}`)
        ]);

        // Row 2: Long (legacy pattern: pos_long:SYMBOL:AMOUNT)
        buttons.push([
            Markup.button.callback('Long $50', `pos_long:${symbol}:50`),
            Markup.button.callback('Long $200', `pos_long:${symbol}:200`),
            Markup.button.callback('Long X', `pos_long_custom:${symbol}`)
        ]);

        // Row 3: Short
        buttons.push([
            Markup.button.callback('Short $50', `pos_short:${symbol}:50`),
            Markup.button.callback('Short $200', `pos_short:${symbol}:200`),
            Markup.button.callback('Short X', `pos_short_custom:${symbol}`)
        ]);

        // Row 4: TP/SL
        buttons.push([
            Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`)
        ]);

        // Row 5: Footer
        buttons.push([
            Markup.button.callback('« Back to Menu', 'menu'),
            Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`)
        ]);

    } else {
        // ================= HAS POSITION (MANAGE) =================
        const size = parseFloat(position.size);
        const pnl = parseFloat(position.unrealizedPnl);
        const entry = parseFloat(position.entryPrice);
        const mark = parseFloat(position.markPrice);
        const liq = position.liquidationPrice ? parseFloat(position.liquidationPrice) : 0;
        const pnlEmoji = pnl >= 0 ? '🟢' : '🔴';
        const pnlSign = pnl >= 0 ? '+' : '';

        // Use POSITION data, not session state (critical for accurate ROE)
        const positionLeverage = parseInt(position.leverage || '1');
        const notional = position.notional ? parseFloat(position.notional) : Math.abs(size * mark);
        const margin = position.initialMargin ? parseFloat(position.initialMargin) : (notional / positionLeverage);
        const roe = margin > 0 ? (pnl / margin) * 100 : 0;
        const roeSign = roe >= 0 ? '+' : '';
        const marginTypeDisplay = position.marginType?.toUpperCase() === 'ISOLATED' ? 'Isolated' : 'Cross';

        // Sync session state with actual position data
        state.leverage = positionLeverage;
        state.marginType = marginTypeDisplay;

        message = `⚡ <b>Manage ${symbol} Position</b>\n\n`;
        message += `<b>${size > 0 ? 'LONG' : 'SHORT'} ${Math.abs(size).toFixed(4)} ${baseAsset}</b> (${positionLeverage}x)\n`;
        message += `Notional: <b>$${notional.toFixed(2)}</b> | Margin: <b>$${margin.toFixed(2)}</b> (${marginTypeDisplay})\n`;
        message += `PnL: <b>${pnlSign}$${pnl.toFixed(2)} (${roeSign}${roe.toFixed(2)}%)</b> ${pnlEmoji}\n`;
        message += `Entry: $${entry.toFixed(4)} | Mark: $${mark.toFixed(4)}\n`;
        if (liq > 0) message += `Liq: $${liq.toFixed(4)}\n`;

        // ================= TP/SL STATUS =================
        // Fetch open orders to show TP/SL status
        let tpOrder: any = null;
        let slOrder: any = null;
        let otherOrders: any[] = [];

        if (authToken) {
            try {
                const ordersRes = await ApiClient.getOpenOrders(authToken, symbol);
                if (ordersRes.success && ordersRes.data) {
                    const orders = ordersRes.data;
                    // Identify TP/SL orders
                    tpOrder = orders.find((o: any) =>
                        o.type?.includes('TAKE_PROFIT') ||
                        (o.type === 'LIMIT' && o.reduceOnly &&
                            ((size > 0 && parseFloat(o.stopPrice || o.price) > entry) ||
                                (size < 0 && parseFloat(o.stopPrice || o.price) < entry)))
                    );
                    slOrder = orders.find((o: any) =>
                        o.type?.includes('STOP') && !o.type?.includes('TAKE_PROFIT') ||
                        (o.type === 'STOP_MARKET' || o.type === 'STOP_LIMIT')
                    );
                    otherOrders = orders.filter((o: any) => o !== tpOrder && o !== slOrder);
                }
            } catch (e) { /* Ignore errors, just don't show TP/SL */ }
        }

        message += '\n━━━━━━━━━━━━━━━━━━━━━━\n';
        message += '🎯 <b>TP/SL Status</b>\n\n';

        if (tpOrder) {
            const tpPrice = parseFloat(tpOrder.stopPrice || tpOrder.price || '0');
            const tpPercent = entry > 0 ? ((tpPrice - entry) / entry) * 100 : 0;
            const tpSign = tpPercent >= 0 ? '+' : '';
            message += `<b>TP:</b> $${tpPrice.toFixed(2)} (${tpSign}${tpPercent.toFixed(1)}%) ✅\n`;
        } else {
            message += `<b>TP:</b> <i>Not set</i> ❌\n`;
        }

        if (slOrder) {
            const slPrice = parseFloat(slOrder.stopPrice || slOrder.price || '0');
            const slPercent = entry > 0 ? ((slPrice - entry) / entry) * 100 : 0;
            const slSign = slPercent >= 0 ? '+' : '';
            message += `<b>SL:</b> $${slPrice.toFixed(2)} (${slSign}${slPercent.toFixed(1)}%) ✅\n`;
        } else {
            message += `<b>SL:</b> <i>Not set</i> ❌\n`;
        }

        if (otherOrders.length > 0) {
            message += `\n📋 <b>Open Orders:</b> ${otherOrders.length}\n`;
        }
        message += '\n';

        // Row 1: Ape (add to position)
        buttons.push([
            Markup.button.callback('Ape $50', `pos_ape:${symbol}:50`),
            Markup.button.callback('Ape $200', `pos_ape:${symbol}:200`),
            Markup.button.callback('Ape X', `pos_ape_custom:${symbol}`)
        ]);

        // Row 2: Margin (only for Isolated)
        if (state.marginType && state.marginType.toUpperCase() === 'ISOLATED') {
            buttons.push([
                Markup.button.callback('➕ Add Margin', `pos_margin_add:${symbol}`),
                Markup.button.callback('➖ Remove Margin', `pos_margin_remove:${symbol}`)
            ]);
        }

        // Row 3: Close
        buttons.push([
            Markup.button.callback('🚨 Close All', `pos_close:${symbol}:100`),
            Markup.button.callback('Sell 50%', `pos_close:${symbol}:50`)
        ]);

        // Row 4: Utils
        buttons.push([
            Markup.button.callback('🎯 Manage TP/SL', `pos_tpsl_mode:${symbol}`),
            Markup.button.callback('📋 Orders', `pos_orders_mode:${symbol}`)
        ]);

        // Row 5: Footer
        buttons.push([
            Markup.button.callback('« Back to Citadel', 'view_account'),
            Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`)
        ]);
    }

    return { message, buttons };
}

// ==================== Entry Point ====================

// Symbol Command Handler (e.g. /ETH, /BTC, /ETHUSDT)
positionComposer.hears(/^\/([A-Z0-9]+)$/i, async (ctx) => {
    const rawSymbol = ctx.match[1].toUpperCase();
    await showPositionMenu(ctx, rawSymbol);
});

// Exported function to show position menu
export async function showPositionMenu(ctx: BotContext, rawSymbol: string) {
    const { authToken, activeExchange } = ctx.session;

    if (!authToken) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    if (ctx.callbackQuery) {
        await ctx.answerCbQuery(`Loading ${rawSymbol}...`);
    } else {
        await ctx.reply(`🔎 Loading ${rawSymbol}...`);
    }

    try {
        const res = await ApiClient.getAccount(authToken, activeExchange || '');
        if (!res.success || !res.data) throw new Error('API Error');

        // Find position (flexible matching) - check ALL positions for leverage sync
        const position = (res.data.positions || []).find((p: any) => {
            const s = p.symbol.toUpperCase();
            return s === rawSymbol || s === `${rawSymbol}USDT` || s === `${rawSymbol}-PERP`;
        });

        // Treat zero size as null position for display, but sync leverage from any found position
        const activePosition = (position && parseFloat(position.size) !== 0) ? position : null;

        // CRITICAL: Sync leverage/margin from exchange data (even for zero-size positions)
        // This ensures our UI shows the actual exchange settings, not stale session defaults
        if (position && position.leverage) {
            if (!ctx.session.tradingState) ctx.session.tradingState = {};
            if (!ctx.session.tradingState[rawSymbol]) {
                ctx.session.tradingState[rawSymbol] = { orderType: 'Market', leverage: 5, marginType: 'Cross' };
            }
            // Sync from exchange position data
            ctx.session.tradingState[rawSymbol].leverage = parseInt(position.leverage) || 5;
            ctx.session.tradingState[rawSymbol].marginType = position.marginType?.toUpperCase() === 'ISOLATED' ? 'Isolated' : 'Cross';
        }

        const targetSymbol = activePosition ? activePosition.symbol : (
            activeExchange === 'aster' && !rawSymbol.endsWith('USDT') ? `${rawSymbol}USDT` : rawSymbol
        );

        const { message, buttons } = await buildPositionInterface(ctx, targetSymbol, activePosition);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
        } else {
            await ctx.reply(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
        }

    } catch (e: any) {
        const errorMsg = `❌ Error: ${e.message}`;
        if (ctx.callbackQuery) {
            await ctx.editMessageText(errorMsg);
        } else {
            await ctx.reply(errorMsg);
        }
    }
}

// ==================== Action Handlers ====================

// Refresh
positionComposer.action(/^pos_refresh:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery('Refreshing...');
    await showPositionMenu(ctx, symbol);
});

// Toggle Order Type (Market <-> Limit) - NO API CALL, just update buttons
positionComposer.action(/^pos_toggle_ordertype:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) ctx.session.tradingState[symbol] = { orderType: 'Market', leverage: 5, marginType: 'Cross' };

    const current = ctx.session.tradingState[symbol].orderType;
    const next = current === 'Market' ? 'Limit' : 'Market';
    ctx.session.tradingState[symbol].orderType = next;

    await ctx.answerCbQuery(`Order Type: ${next}`);

    // Just update buttons, don't refetch data
    const state = ctx.session.tradingState[symbol];
    const buttons = [
        [
            Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
            Markup.button.callback(`${state.leverage}x`, `pos_leverage_menu:${symbol}`),
            Markup.button.callback(`🔄 ${state.marginType}`, `pos_toggle_margin:${symbol}`)
        ],
        [
            Markup.button.callback('Long $50', `pos_long:${symbol}:50`),
            Markup.button.callback('Long $200', `pos_long:${symbol}:200`),
            Markup.button.callback('Long X', `pos_long_custom:${symbol}`)
        ],
        [
            Markup.button.callback('Short $50', `pos_short:${symbol}:50`),
            Markup.button.callback('Short $200', `pos_short:${symbol}:200`),
            Markup.button.callback('Short X', `pos_short_custom:${symbol}`)
        ],
        [Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`)],
        [
            Markup.button.callback('« Back to Menu', 'menu'),
            Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`)
        ]
    ];
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

// Toggle Margin Type (Cross <-> Isolated) - NO API CALL, just update buttons
positionComposer.action(/^pos_toggle_margin:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) ctx.session.tradingState[symbol] = { orderType: 'Market', leverage: 5, marginType: 'Cross' };

    const current = ctx.session.tradingState[symbol].marginType || 'Cross';
    const next = current === 'Cross' ? 'Isolated' : 'Cross';
    ctx.session.tradingState[symbol].marginType = next;

    await ctx.answerCbQuery(`Margin: ${next}`);

    // Just update buttons, don't refetch data
    const state = ctx.session.tradingState[symbol];
    const buttons = [
        [
            Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
            Markup.button.callback(`${state.leverage}x`, `pos_leverage_menu:${symbol}`),
            Markup.button.callback(`🔄 ${state.marginType}`, `pos_toggle_margin:${symbol}`)
        ],
        [
            Markup.button.callback('Long $50', `pos_long:${symbol}:50`),
            Markup.button.callback('Long $200', `pos_long:${symbol}:200`),
            Markup.button.callback('Long X', `pos_long_custom:${symbol}`)
        ],
        [
            Markup.button.callback('Short $50', `pos_short:${symbol}:50`),
            Markup.button.callback('Short $200', `pos_short:${symbol}:200`),
            Markup.button.callback('Short X', `pos_short_custom:${symbol}`)
        ],
        [Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`)],
        [
            Markup.button.callback('« Back to Menu', 'menu'),
            Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`)
        ]
    ];
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

// Leverage Menu
positionComposer.action(/^pos_leverage_menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const currentLeverage = ctx.session.tradingState?.[symbol]?.leverage || 5;

    const leverageOptions = [2, 5, 10, 20];
    const leverageButtons = leverageOptions.map(lev => {
        const label = lev === currentLeverage ? `✅${lev}x` : `${lev}x`;
        return Markup.button.callback(label, `pos_set_leverage:${symbol}:${lev}`);
    });

    await ctx.editMessageReplyMarkup(
        Markup.inlineKeyboard([
            leverageButtons.slice(0, 2),
            leverageButtons.slice(2, 4),
            [Markup.button.callback('Custom', `pos_leverage_custom:${symbol}`)],
            [Markup.button.callback('« Back', `pos_refresh:${symbol}`)]
        ]).reply_markup
    );
});

// Set Leverage (preset) - NO API CALL, just update buttons
positionComposer.action(/^pos_set_leverage:(.+):(\d+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    const leverage = parseInt(ctx.match[2]);

    if (!ctx.session.tradingState) ctx.session.tradingState = {};
    if (!ctx.session.tradingState[symbol]) ctx.session.tradingState[symbol] = { orderType: 'Market', leverage: 5, marginType: 'Cross' };
    ctx.session.tradingState[symbol].leverage = leverage;

    await ctx.answerCbQuery(`Leverage: ${leverage}x`);

    // Just update buttons, don't refetch data
    const state = ctx.session.tradingState[symbol];
    const buttons = [
        [
            Markup.button.callback(`🔄 ${state.orderType}`, `pos_toggle_ordertype:${symbol}`),
            Markup.button.callback(`${state.leverage}x`, `pos_leverage_menu:${symbol}`),
            Markup.button.callback(`🔄 ${state.marginType}`, `pos_toggle_margin:${symbol}`)
        ],
        [
            Markup.button.callback('Long $50', `pos_long:${symbol}:50`),
            Markup.button.callback('Long $200', `pos_long:${symbol}:200`),
            Markup.button.callback('Long X', `pos_long_custom:${symbol}`)
        ],
        [
            Markup.button.callback('Short $50', `pos_short:${symbol}:50`),
            Markup.button.callback('Short $200', `pos_short:${symbol}:200`),
            Markup.button.callback('Short X', `pos_short_custom:${symbol}`)
        ],
        [Markup.button.callback('🎯 Set TP/SL', `pos_tpsl_mode:${symbol}`)],
        [
            Markup.button.callback('« Back to Menu', 'menu'),
            Markup.button.callback('🔄 Refresh', `pos_refresh:${symbol}`)
        ]
    ];
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons).reply_markup);
});

// Custom Leverage
positionComposer.action(/^pos_leverage_custom:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    const currentLeverage = ctx.session.tradingState?.[symbol]?.leverage || 5;
    await ctx.answerCbQuery();
    await ctx.scene.enter('leverage-wizard', { symbol, currentLeverage });
});

// ==================== Trading Handlers (Launch Wizards) ====================

// Long with fixed amount (e.g. pos_long:BTCUSDT:50)
positionComposer.action(/^pos_long:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];
    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';

    await ctx.scene.enter(
        isMarket ? 'market-order-wizard' : 'limit-order-wizard',
        {
            symbol,
            side: 'BUY',
            leverage: state?.leverage,
            marginType: state?.marginType,
            prefilledAmount: `$${amount}`,
            retryCount: 0,
        }
    );
});

// Long Custom
positionComposer.action(/^pos_long_custom:(.+)$/, async (ctx) => {
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
            retryCount: 0,
        }
    );
});

// Short with fixed amount
positionComposer.action(/^pos_short:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];
    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';

    await ctx.scene.enter(
        isMarket ? 'market-order-wizard' : 'limit-order-wizard',
        {
            symbol,
            side: 'SELL',
            leverage: state?.leverage,
            marginType: state?.marginType,
            prefilledAmount: `$${amount}`,
            retryCount: 0,
        }
    );
});

// Short Custom
positionComposer.action(/^pos_short_custom:(.+)$/, async (ctx) => {
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
            retryCount: 0,
        }
    );
});

// Ape with fixed amount (add to existing position)
positionComposer.action(/^pos_ape:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const amount = ctx.match[2];
    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';

    // Ape continues the position direction, so BUY
    await ctx.scene.enter(
        isMarket ? 'market-order-wizard' : 'limit-order-wizard',
        {
            symbol,
            side: 'BUY',
            leverage: state?.leverage,
            marginType: state?.marginType,
            prefilledAmount: `$${amount}`,
            retryCount: 0,
        }
    );
});

// Ape Custom
positionComposer.action(/^pos_ape_custom:(.+)$/, async (ctx) => {
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
            retryCount: 0,
        }
    );
});

// Close with percentage
positionComposer.action(/^pos_close:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const percentage = parseInt(ctx.match[2]);
    const { authToken, activeExchange } = ctx.session;

    if (!authToken) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    // For 100% close, use direct API call instead of wizard
    if (percentage === 100) {
        try {
            await ctx.reply(`⏳ Closing ${symbol} position...`);

            const result = await ApiClient.closePosition(authToken, {
                exchange: activeExchange || '',
                symbol: symbol
            });

            if (result.success) {
                await ctx.reply(`✅ Position closed successfully!`);
            } else {
                await ctx.reply(`❌ Close failed: ${result.error || 'Unknown error'}`);
            }

            // Refresh position menu
            await showPositionMenu(ctx, symbol.replace(/USDT$/, ''));
        } catch (error: any) {
            await ctx.reply(`❌ Close failed: ${error.message}`);
        }
        return;
    }

    // For partial close, use wizard flow
    const state = ctx.session.tradingState?.[symbol];
    const isMarket = state?.orderType === 'Market';

    await ctx.scene.enter(
        isMarket ? 'market-order-wizard' : 'limit-order-wizard',
        {
            symbol,
            side: 'SELL',
            leverage: state?.leverage,
            marginType: state?.marginType,
            prefilledAmount: `${percentage}%`,
            reduceOnly: true,
            retryCount: 0,
        }
    );
});

// TP/SL Mode
positionComposer.action(/^pos_tpsl_mode:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery('TP/SL Menu');
    await ctx.scene.enter('position-tpsl', { symbol });
});

// Orders Mode
positionComposer.action(/^pos_orders_mode:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery('Orders Menu');
    await ctx.reply('📋 Orders management coming soon!');
});

// Margin Add/Remove
positionComposer.action(/^pos_margin_(add|remove):(.+)$/, async (ctx) => {
    const action = ctx.match[1].toUpperCase() as 'ADD' | 'REMOVE';
    const symbol = ctx.match[2];
    await ctx.answerCbQuery();
    await ctx.scene.enter('margin-wizard', { symbol, action });
});

// Generic Back to Position Handler
positionComposer.action(/^manage_pos_(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await showPositionMenu(ctx, symbol);
});
