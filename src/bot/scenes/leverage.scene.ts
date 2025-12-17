import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

// Leverage Wizard
// Step 1: Input or Preset from button
// Step 2: Confirm & Execute

interface LeverageWizardState {
    symbol: string;
    leverage?: number;
    currentLeverage?: number;
}

export const leverageWizard = new Scenes.WizardScene<BotContext>(
    'leverage-wizard',

    // Step 1: Ask for input
    async (ctx) => {
        const state = ctx.wizard.state as LeverageWizardState;
        if (!state.symbol) return ctx.scene.leave();

        // If leverage preset was passed in state, skip to execution
        if (state.leverage) {
            ctx.wizard.selectStep(1);
            return ctx.wizard.steps[1](ctx);
        }

        const msg = `⚙️ **Set Leverage - ${state.symbol}**\n\n` +
            `Current: ${state.currentLeverage || '?'}x\n` +
            `Enter new leverage (1-125):`;

        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('5x', 'lev_5'), Markup.button.callback('10x', 'lev_10'), Markup.button.callback('20x', 'lev_20')],
                [Markup.button.callback('❌ Cancel', 'lev_cancel')]
            ])
        });

        return ctx.wizard.next();
    },

    // Step 2: Handle Input & Execute
    async (ctx) => {
        const state = ctx.wizard.state as LeverageWizardState;
        let leverage = state.leverage;

        // If no leverage yet, check message
        if (!leverage && ctx.message && 'text' in ctx.message) {
            const val = parseInt(ctx.message.text);
            if (isNaN(val) || val < 1 || val > 125) {
                await ctx.reply('❌ Invalid. Enter 1-125.');
                return;
            }
            leverage = val;
        }

        if (!leverage) return; // Wait for valid input

        await ctx.reply(`🔄 Setting leverage to ${leverage}x...`);

        try {
            const { authToken, activeExchange } = ctx.session;
            if (!authToken) throw new Error('No auth');

            const res = await ApiClient.setLeverage(authToken, {
                exchange: activeExchange || '',
                symbol: state.symbol,
                leverage: leverage
            });

            if (res.success) {
                await ctx.reply(`✅ Leverage set to ${leverage}x`);
            } else {
                await ctx.reply(`❌ Failed: ${res.error}`);
            }
        } catch (e: any) {
            await ctx.reply(`❌ Error: ${e.message}`);
        }

        await ctx.scene.leave();
        // Return to manage menu
        // We can re-trigger the manage menu by calling a helper or sending a message with button
        await ctx.reply('Back to menu', Markup.inlineKeyboard([
            Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
        ]));
    }
);

// Actions
leverageWizard.action(/^lev_(\d+)$/, async (ctx) => {
    const lev = parseInt(ctx.match[1]);
    (ctx.wizard.state as LeverageWizardState).leverage = lev;
    // Jump to step 2 manually? Or just call it.
    // Calling step 2 directly needs context.
    // Easier to selectStep and call handler.
    ctx.wizard.selectStep(1);
    return ctx.wizard.steps[1](ctx);
});

leverageWizard.action('lev_cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.scene.leave();
    const state = ctx.wizard.state as LeverageWizardState;
    if (state.symbol) {
        await ctx.reply('Back', Markup.inlineKeyboard([
            Markup.button.callback('« Back to Position', `manage_pos_${state.symbol}`)
        ]));
    }
});
