import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

interface TpslState {
    symbol?: string;
    type?: 'TP' | 'SL';
    price?: number;
}

export const tpslScene = new Scenes.WizardScene<BotContext>(
    'position-tpsl',

    // Step 1: Select Type (TP or SL)
    async (ctx) => {
        const state = ctx.wizard.state as TpslState;
        if (!state.symbol) return ctx.scene.leave();

        await ctx.reply(`🎯 **Set TP/SL for ${state.symbol}**\n\nSelect type:`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('Take Profit (TP)', 'type_tp')],
                [Markup.button.callback('Stop Loss (SL)', 'type_sl')],
                [Markup.button.callback('❌ Cancel', 'cancel')]
            ])
        });
        return ctx.wizard.next();
    },

    // Step 2: Ask for Price
    async (ctx) => {
        const state = ctx.wizard.state as TpslState;

        if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;
            if (action === 'cancel') return ctx.scene.leave();

            if (action === 'type_tp') state.type = 'TP';
            else if (action === 'type_sl') state.type = 'SL';
            else return; // Ignore unknown

            await ctx.answerCbQuery();
        } else {
            return; // Wait for button
        }

        await ctx.reply(`Enter **${state.type} Price** for ${state.symbol}:`, { parse_mode: 'Markdown' });
        return ctx.wizard.next();
    },

    // Step 3: Execute
    async (ctx) => {
        const state = ctx.wizard.state as TpslState;
        let priceText = '';

        if (ctx.message && 'text' in ctx.message) {
            priceText = ctx.message.text;
        } else {
            await ctx.reply('Please enter a valid number.');
            return;
        }

        const price = parseFloat(priceText);
        if (isNaN(price) || price <= 0) {
            await ctx.reply('❌ Invalid price.');
            return;
        }

        await ctx.reply('⏳ Setting order...');

        const { authToken, activeExchange } = ctx.session;

        try {
            const params: any = {
                exchange: activeExchange,
                symbol: state.symbol
            };

            if (state.type === 'TP') params.tp = price.toString();
            if (state.type === 'SL') params.sl = price.toString();

            const res = await ApiClient.setTpSl(authToken!, params);

            if (res.success) {
                await ctx.reply(`✅ **${state.type} Set!**\n\nSymbol: ${state.symbol}\nPrice: ${price}`);
            } else {
                await ctx.reply(`❌ **Failed**\n\nError: ${res.error}`);
            }

        } catch (e: any) {
            await ctx.reply(`❌ Error: ${e.message}`);
        }

        await ctx.scene.leave();

        // Navigation Back
        if (state.symbol) {
            await ctx.reply('Back to menu', Markup.inlineKeyboard([
                Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
            ]));
        }
    }
);

tpslScene.action('cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('❌ Cancelled.');
    await ctx.scene.leave();
    const state = ctx.wizard.state as TpslState;
    if (state.symbol) {
        await ctx.reply('Back to menu', Markup.inlineKeyboard([
            Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
        ]));
    }
});
