/**
 * Market Order Wizard Scene
 * 
 * Ported from legacy trade.scene.ts with multi-exchange support
 * 
 * Flow:
 * - If prefilledAmount: Skip to confirmation
 * - Else: Ask for amount (accepts $50, 15%, 0.5 BTC)
 * - Execute order via ApiClient
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';
import { parseAmount, formatParsedAmount, parsedAmountToParams } from '../utils/inputParser';
import { showPositionMenu } from '../composers/position.composer';
import { usdToQuantity } from '../utils/quantityFormatter';
import { getCachedTicker, setCachedTicker } from '../services/priceCache.service';

interface MarketOrderState {
    symbol: string;
    side: 'BUY' | 'SELL';
    leverage?: number;
    marginType?: string;
    prefilledAmount?: string;  // From $50/$200 buttons
    retryCount: number;
}

/**
 * Return to Position Menu after wizard completes
 */
async function returnToPosition(ctx: BotContext, state: MarketOrderState) {
    if (state.symbol) {
        await showPositionMenu(ctx, state.symbol);
    }
}

export const marketOrderScene = new Scenes.WizardScene<BotContext>(
    'market-order-wizard',

    // Step 1: Ask for amount (or skip if prefilled)
    async (ctx) => {
        const state = ctx.wizard.state as MarketOrderState;

        if (state.retryCount === undefined) {
            state.retryCount = 0;
        }

        if (!state.symbol || !state.side) {
            await ctx.reply('❌ Invalid wizard state. Please try again.');
            return ctx.scene.leave();
        }

        // Check for prefilled amount (from $50/$200 buttons)
        if (state.prefilledAmount) {
            // Skip to step 2 (confirmation)
            ctx.wizard.selectStep(1);
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }

        const action = state.side === 'BUY' ? 'Long' : 'Short';
        const leverage = state.leverage || 5;
        const marginType = state.marginType || 'Cross';
        const baseAsset = state.symbol.replace(/USDT$|USD$|PERP$/, '');

        await ctx.reply(
            `💰 **${action} ${state.symbol}** (MARKET)\n\n` +
            `Leverage: ${leverage}x ${marginType}\n\n` +
            `Enter amount:\n` +
            `• $50 (USDT)\n` +
            `• 15% (of available margin)\n` +
            `• 0.5 ${baseAsset}\n\n` +
            `Type your amount:`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
                ])
            }
        );

        return ctx.wizard.next();
    },

    // Step 2: Process amount and execute
    async (ctx) => {
        const state = ctx.wizard.state as MarketOrderState;
        const { authToken, activeExchange } = ctx.session;

        // For prefilled amounts, use directly
        const isPrefilled = state.prefilledAmount !== undefined;

        // Check for text input
        if (!isPrefilled) {
            if (!ctx.message || !('text' in ctx.message)) {
                await ctx.reply('Please send a text message with your amount.');
                return; // Stay in same step
            }
        }

        const input = isPrefilled ? state.prefilledAmount! : (ctx.message as any).text;

        // Check for cancel
        if (input.toLowerCase() === 'cancel' || input === '/cancel') {
            await ctx.reply('❌ Order cancelled.');
            await returnToPosition(ctx, state);
            return ctx.scene.leave();
        }

        // Parse amount
        const parsed = parseAmount(input, state.symbol);
        if (!parsed) {
            state.retryCount++;

            if (state.retryCount >= 2) {
                const baseAsset = state.symbol.replace(/USDT$|USD$|PERP$/, '');
                await ctx.reply(
                    `⚠️ Too many invalid attempts. Returning to position menu...\n\n` +
                    `Valid formats:\n` +
                    `• $50 or 50 → $50 USD\n` +
                    `• 15% → 15% of margin\n` +
                    `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
                );
                await returnToPosition(ctx, state);
                return ctx.scene.leave();
            }

            const baseAsset = state.symbol.replace(/USDT$|USD$|PERP$/, '');
            await ctx.reply(
                `❌ Invalid amount format. Please try again.\n\n` +
                `Examples:\n` +
                `• $50 or 50 → $50 USD\n` +
                `• 15% → 15% of margin\n` +
                `• 0.5 ${baseAsset} → 0.5 ${baseAsset}`
            );
            return; // Stay in same step
        }

        // Show confirmation
        const action = state.side === 'BUY' ? 'Long' : 'Short';
        const formattedAmount = formatParsedAmount(parsed, state.symbol);

        await ctx.reply(
            `🛡️ **Confirm ${action}**\n\n` +
            `Asset: **${state.symbol}**\n` +
            `Amount: **${formattedAmount}**\n` +
            `Leverage: ${state.leverage || 5}x ${state.marginType || 'Cross'}\n` +
            `Order Type: Market\n\n` +
            `Proceed?`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`✅ CONFIRM ${action.toUpperCase()}`, 'confirm_order')],
                    [Markup.button.callback('❌ Cancel', 'cancel_wizard')]
                ])
            }
        );

        // Store parsed for confirmation step
        (state as any).parsedAmount = parsed;

        return ctx.wizard.next();
    },

    // Step 3: Execute Order
    async (ctx) => {
        const state = ctx.wizard.state as MarketOrderState;
        const { authToken, activeExchange } = ctx.session;

        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;

            if (action === 'cancel_wizard') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.editMessageText('❌ Order cancelled.');
                await returnToPosition(ctx, state);
                return ctx.scene.leave();
            }

            if (action === 'confirm_order') {
                await ctx.answerCbQuery('Sending order...');
                await ctx.editMessageText('🚀 Sending order...');

                const parsed = (state as any).parsedAmount;
                if (!parsed || !authToken) {
                    await ctx.reply('❌ Error: Invalid order state.');
                    return ctx.scene.leave();
                }

                try {
                    // Convert parsed amount to order params
                    const quantityParams = parsedAmountToParams(parsed);

                    // Build order params
                    const orderParams: any = {
                        exchange: activeExchange,
                        symbol: state.symbol,
                        side: state.side,
                        type: 'MARKET',
                    };

                    // For USD/Percent, we need to calculate quantity with proper precision
                    if (quantityParams.quantity) {
                        orderParams.quantity = quantityParams.quantity;
                    } else if (quantityParams.quantityInUSD) {
                        // Check cache first, then fetch
                        let price: number;
                        const cached = getCachedTicker(activeExchange || '', state.symbol);

                        if (cached) {
                            price = parseFloat(cached.price);
                        } else {
                            const tickerRes = await ApiClient.getTicker(authToken, state.symbol, activeExchange);
                            if (tickerRes.success && tickerRes.data) {
                                price = parseFloat(tickerRes.data.price);
                                // Cache for future use
                                setCachedTicker(activeExchange || '', state.symbol, {
                                    symbol: state.symbol,
                                    price: tickerRes.data.price,
                                    change24h: tickerRes.data.change24h || '0',
                                    high24h: tickerRes.data.high24h || '0',
                                    low24h: tickerRes.data.low24h || '0',
                                    volume24h: tickerRes.data.volume24h || '0',
                                });
                            } else {
                                // Detailed error message
                                const errDetail = tickerRes.error || 'API returned failure';
                                console.error('[MarketOrder] Ticker fetch failed:', errDetail);
                                throw new Error(`Could not fetch price: ${errDetail}`);
                            }
                        }

                        const usdAmount = parseFloat(quantityParams.quantityInUSD);
                        // Use formatter for proper precision
                        orderParams.quantity = usdToQuantity(usdAmount, price, state.symbol);
                    } else if (quantityParams.quantityAsPercent) {
                        // Need account balance to calculate
                        const accountRes = await ApiClient.getAccount(authToken, activeExchange);
                        if (accountRes.success && accountRes.data) {
                            const availableBalance = parseFloat(accountRes.data.availableBalance);
                            const pct = parseFloat(quantityParams.quantityAsPercent);
                            const usdAmount = (availableBalance * pct) / 100;

                            // Use cached price if available
                            let price: number;
                            const cached = getCachedTicker(activeExchange || '', state.symbol);

                            if (cached) {
                                price = parseFloat(cached.price);
                            } else {
                                const tickerRes = await ApiClient.getTicker(authToken, state.symbol, activeExchange);
                                if (tickerRes.success && tickerRes.data) {
                                    price = parseFloat(tickerRes.data.price);
                                } else {
                                    throw new Error('Could not fetch price');
                                }
                            }

                            orderParams.quantity = usdToQuantity(usdAmount, price, state.symbol);
                        } else {
                            throw new Error('Could not fetch account balance');
                        }
                    }

                    // Place order
                    const res = await ApiClient.placeOrder(authToken, orderParams);

                    if (res.success) {
                        const sideLabel = state.side === 'BUY' ? 'Long' : 'Short';
                        await ctx.reply(`✅ **Order Filled!**\n\n${sideLabel} ${orderParams.quantity} ${state.symbol}`, { parse_mode: 'Markdown' });
                    } else {
                        await ctx.reply(`❌ **Order Failed**\n\n${res.error}`, { parse_mode: 'Markdown' });
                    }

                } catch (e: any) {
                    await ctx.reply(`❌ **Order Error**\n\n${e.message}`, { parse_mode: 'Markdown' });
                }

                await ctx.scene.leave();

                // Navigate back to position
                await returnToPosition(ctx, state);
                return;
            }
        }

        await ctx.reply('Please click a confirmation button.');
    }
);

// Cancel handler
marketOrderScene.action('cancel_wizard', async (ctx) => {
    const state = ctx.wizard.state as MarketOrderState;
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Order cancelled.');
    await ctx.scene.leave();
    await returnToPosition(ctx, state);
});

marketOrderScene.action('confirm_order', async (ctx) => {
    // Forward to step 3
    return ctx.wizard.steps[2](ctx);
});
