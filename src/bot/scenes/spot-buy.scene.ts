import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

// Helper to clean number strings
const cleanNum = (n: string | number) => parseFloat(n.toString()).toFixed(2);

interface SpotBuyState {
    symbol?: string;
    availableBalance?: number;
    currentPrice?: number;
    baseAsset?: string;
    amountToBuy?: number;
    side?: 'BUY' | 'SELL';
    isPerp?: boolean;
}

export const spotBuyScene = new Scenes.WizardScene<BotContext>(
    'spot-buy',

    // Step 1: Ask for Amount
    async (ctx) => {
        const state = ctx.wizard.state as SpotBuyState;

        // Initialize state defaults
        if (!state.symbol) state.symbol = 'ASTERUSDT';
        if (!state.side) state.side = 'BUY'; // Default

        const symbol = state.symbol;
        const side = state.side;
        const typeLabel = state.isPerp ? 'Perp' : 'Spot';
        const actionLabel = side === 'BUY' ? 'Buy' : 'Sell';

        const { authToken, activeExchange } = ctx.session;

        // Check for prefilled amount or bypass
        if (state.amountToBuy) {
            try {
                const tickerRes = await ApiClient.getTicker(authToken!, symbol, activeExchange);
                if (tickerRes.success) state.currentPrice = parseFloat(tickerRes.data.lastPrice);
            } catch (e) { }

            ctx.wizard.selectStep(1);
            return (ctx.wizard as any).steps[1](ctx);
        }

        if (!authToken) {
            await ctx.reply('❌ Session expired. Please /link again.');
            return ctx.scene.leave();
        }

        await ctx.reply(`💰 **${actionLabel} ${symbol}** (${typeLabel})\n\nFetching price & balance...`, { parse_mode: 'Markdown' });

        try {
            const [accountRes, tickerRes] = await Promise.all([
                ApiClient.getAccount(authToken, activeExchange),
                ApiClient.getTicker(authToken, symbol, activeExchange)
            ]);

            if (!accountRes.success || !accountRes.data) throw new Error('Failed to fetch account');
            if (!tickerRes.success || !tickerRes.data) throw new Error('Failed to fetch ticker');

            // For SELL on Spot, available is Base Asset balance. For BUY, it's Quote (USDT).
            // For Perps, it's Margin (USDT).
            // This logic is complex. For now, simplistically show "Available Balance" (USDT) for Perps/Buy.
            // For Spot Sell, we need to find the specific asset balance.

            let available = parseFloat(accountRes.data.availableBalance);

            // Refine available balance for Spot Sell
            if (!state.isPerp && side === 'SELL') {
                const base = symbol.replace('USDT', '').replace('USDC', '');
                const bal = (accountRes.data.balances || []).find((b: any) => b.asset === base);
                if (bal) available = parseFloat(bal.free);
                else available = 0; // Asset not found
            }

            const price = parseFloat(tickerRes.data.lastPrice);

            state.availableBalance = available;
            state.currentPrice = price;
            state.baseAsset = symbol.replace('USDT', '').replace('USDC', '');

            const availLabel = (!state.isPerp && side === 'SELL') ? state.baseAsset : 'USDT';

            await ctx.reply(
                `📉 Price: $${price}\n` +
                `💵 Available: ${available.toFixed(4)} ${availLabel}\n\n` +
                `How much to ${actionLabel.toLowerCase()}?`,
                {
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('25%', 'pct_25'), Markup.button.callback('50%', 'pct_50')],
                        [Markup.button.callback('75%', 'pct_75'), Markup.button.callback('100%', 'pct_100')],
                        [Markup.button.callback('❌ Cancel', 'cancel')]
                    ])
                }
            );
            return ctx.wizard.next();

        } catch (e: any) {
            await ctx.reply(`❌ Error: ${e.message}`);
            return ctx.scene.leave();
        }
    },

    // Step 2: Confirmation
    async (ctx) => {
        const state = ctx.wizard.state as SpotBuyState;
        let inputAmount = '';
        const side = state.side || 'BUY';
        const actionLabel = side === 'BUY' ? 'Buy' : 'Sell';

        // Check callback queries (buttons)
        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;
            if (action === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.reply('❌ Cancelled.');
                await ctx.scene.leave();

                if (state.isPerp && state.symbol) {
                    await ctx.reply('Back to Position', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
                    ]));
                } else {
                    await ctx.reply('Back to Menu', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Menu', 'menu')
                    ]));
                }
                return;
            }
            if (action.startsWith('pct_')) {
                const pct = parseInt(action.replace('pct_', ''));
                const balance = state.availableBalance || 0;
                inputAmount = (balance * (pct / 100)).toString();
                await ctx.answerCbQuery(`${pct}% selected`);
            }
        }
        // Check text input
        else if (ctx.message && 'text' in ctx.message) {
            inputAmount = ctx.message.text;
        }

        // Validate
        const amount = parseFloat(inputAmount);
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply('❌ Invalid amount. Please enter a number or select a percentage.');
            return; // Stay on this step
        }

        const balance = state.availableBalance || 0;
        if (amount > balance) {
            await ctx.reply(`❌ Insufficient balance. Max: ${balance.toFixed(4)}`);
            return;
        }

        state.amountToBuy = amount;

        await ctx.reply(
            `🛡️ **Confirm ${actionLabel}**\n\n` +
            `Asset: **${state.baseAsset}**\n` +
            `Amount: **${amount.toFixed(4)}**\n` +
            `Type: ${state.isPerp ? 'Perp' : 'Spot'}\n` +
            `Approx. Price: $${state.currentPrice}\n\n` +
            `Proceed?`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`✅ CONFIRM ${actionLabel.toUpperCase()}`, 'confirm_buy')],
                    [Markup.button.callback('❌ Cancel', 'cancel')]
                ])
            }
        );

        return ctx.wizard.next();
    },

    // Step 3: Execution
    async (ctx) => {
        const state = ctx.wizard.state as SpotBuyState;
        const side = state.side || 'BUY';

        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;

            if (action === 'cancel') {
                await ctx.answerCbQuery('Cancelled');
                await ctx.reply('❌ Order cancelled.');
                await ctx.scene.leave();

                if (state.isPerp && state.symbol) {
                    await ctx.reply('Back to Position', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
                    ]));
                } else {
                    await ctx.reply('Back to Menu', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Menu', 'menu')
                    ]));
                }
                return;
            }

            if (action === 'confirm_buy') {
                await ctx.answerCbQuery('Sending order...');
                await ctx.reply('🚀 Sending order...');

                const { authToken, activeExchange } = ctx.session;
                const { symbol, amountToBuy } = state;

                try {
                    const params: any = {
                        exchange: activeExchange,
                        symbol: symbol,
                        side: side,
                        type: 'MARKET',
                    };

                    // Calculate Quantity
                    // Aster FAPI requires quantity in Base Asset (Lots) for Market Orders?
                    // Usually yes.
                    // If we have quantityInUSD (Buy/Perp), convert to Quantity.
                    let finalQuantity = amountToBuy || 0;

                    if (state.side === 'BUY' || state.isPerp) {
                        // USD Amount -> Base Asset Amount
                        // We use state.currentPrice. If missing, we might need to fetch ticker again?
                        // It should be in state from Step 1 options usage.
                        // But Step 2 uses 'state.currentPrice' for display confirmation, so it exists.
                        const price = state.currentPrice || 1;
                        // Helper: Apply precision. Default 4 decimals for now.
                        finalQuantity = parseFloat(((amountToBuy || 0) / price).toFixed(5));
                    }

                    params.quantity = finalQuantity;
                    // remove quantityInUSD if it exists (not needed for adapter)
                    delete params.quantityInUSD;

                    const res = await ApiClient.placeOrder(authToken!, params);

                    if (res.success) {
                        await ctx.reply(`✅ **Order Filled!**\n\n${side} ${cleanNum(amountToBuy || 0)} of ${symbol}`);
                    } else {
                        await ctx.reply(`❌ **Order Failed**\n\n${res.error}`);
                    }

                } catch (e: any) {
                    await ctx.reply(`❌ System Error: ${e.message}`);
                }

                await ctx.scene.leave();

                if (state.isPerp && state.symbol) {
                    await ctx.reply('Back to Position', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
                    ]));
                } else {
                    await ctx.reply('Back to Menu', Markup.inlineKeyboard([
                        Markup.button.callback('« Back to Menu', 'menu')
                    ]));
                }
                return;
            }
        }

        // If user typed something else instead of clicking button
        await ctx.reply('Please click confirmation buttons.');
        return;
    }
);
