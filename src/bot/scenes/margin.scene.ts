import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

interface MarginWizardState {
    symbol: string;
    action?: 'ADD' | 'REMOVE';
    amount?: number;
    currentMargin?: number;
}

export const marginWizard = new Scenes.WizardScene<BotContext>(
    'margin-wizard',

    // Step 1: Choose Action (Add / Remove)
    async (ctx) => {
        const state = ctx.wizard.state as MarginWizardState;
        if (!state.symbol) return ctx.scene.leave();

        const msg = `🛠️ **Margin Management - ${state.symbol}**\n\n` +
            `Current Margin: $${state.currentMargin?.toFixed(2) || '?'}\n` +
            `Select action:`;

        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('➕ Add Margin', 'margin_add'), Markup.button.callback('➖ Remove Margin', 'margin_remove')],
                [Markup.button.callback('❌ Cancel', 'margin_cancel')]
            ])
        });

        return ctx.wizard.next();
    },

    // Step 2: Enter Amount
    async (ctx) => {
        const state = ctx.wizard.state as MarginWizardState;

        // Wait for action selection via button
        if (!state.action) return;

        const actionText = state.action === 'ADD' ? 'Add' : 'Remove';
        await ctx.reply(`Enter amount to ${actionText} (USDT):`, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'margin_cancel')]
        ]));

        return ctx.wizard.next();
    },

    // Step 3: Execute
    async (ctx) => {
        const state = ctx.wizard.state as MarginWizardState;

        let amount = state.amount;
        if (!amount && ctx.message && 'text' in ctx.message) {
            const val = parseFloat(ctx.message.text);
            if (isNaN(val) || val <= 0) {
                await ctx.reply('❌ Invalid amount.');
                return;
            }
            amount = val;
        }

        if (!amount) return;

        await ctx.reply('🔄 Updating margin...');

        try {
            const { authToken, activeExchange } = ctx.session;
            const res = await ApiClient.updateMargin(authToken!, {
                exchange: activeExchange || '',
                symbol: state.symbol,
                amount: amount,
                type: state.action!
            });

            if (res.success) {
                await ctx.reply('✅ Margin updated successfully.');
            } else {
                await ctx.reply(`❌ Failed: ${res.error}`);
            }
        } catch (e: any) {
            await ctx.reply(`❌ Error: ${e.message}`);
        }

        await ctx.scene.leave();
        await ctx.reply('Back to menu', Markup.inlineKeyboard([
            Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
        ]));
    }
);

// Actions
marginWizard.action(/^margin_(add|remove)$/, async (ctx) => {
    const action = ctx.match[1].toUpperCase() as 'ADD' | 'REMOVE';
    (ctx.wizard.state as MarginWizardState).action = action;
    ctx.wizard.selectStep(2);
    return ctx.wizard.steps[2](ctx);
});

marginWizard.action('margin_cancel', async (ctx) => {
    const state = ctx.wizard.state as MarginWizardState;
    await ctx.answerCbQuery('Cancelled');
    await ctx.scene.leave();
    if (state.symbol) {
        await ctx.reply('Back', Markup.inlineKeyboard([
            Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
        ]));
    }
});
