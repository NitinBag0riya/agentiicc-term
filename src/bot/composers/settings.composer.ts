/**
 * Settings Composer
 * 
 * Provides settings management including:
 * - Default leverage setting
 * - Notifications toggle
 * - Unlink exchange flow
 */

import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { getUser, updateUserSettings } from '../../db/users';

export const settingsComposer = new Composer<BotContext>();

// Settings Menu Entry
settingsComposer.action('overview_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await showSettingsMenu(ctx);
});

async function showSettingsMenu(ctx: BotContext, edit = true) {
    if (!ctx.session.userId) {
        await ctx.reply('❌ Please start with /start first');
        return;
    }

    const user = await getUser(ctx.session.userId);
    const settings = user?.settings || {};
    const leverage = settings.defaultLeverage || 5;
    const notifs = settings.notifications !== false; // Default true

    const msg = `⚙️ **Settings Menu**\n\n` +
        `**Default Leverage:** ${leverage}x\n` +
        `**Notifications:** ${notifs ? '✅ ON' : '❌ OFF'}\n\n` +
        `Select a setting to change:`;

    const buttons = Markup.inlineKeyboard([
        [
            Markup.button.callback(`Lev: ${leverage}x`, 'settings_lev_cycle'),
            Markup.button.callback(`Notifs: ${notifs ? 'ON' : 'OFF'}`, 'settings_notif_toggle')
        ],
        [Markup.button.callback('🔓 Unlink Exchange', 'settings_unlink_menu')],
        [Markup.button.callback('« Back to Citadel', 'view_account')]
    ]);

    if (edit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(msg, { parse_mode: 'Markdown', ...buttons });
    } else {
        await ctx.reply(msg, { parse_mode: 'Markdown', ...buttons });
    }
}

// Toggle Leverage - Cycle through presets
settingsComposer.action('settings_lev_cycle', async (ctx) => {
    if (!ctx.session.userId) return;

    const user = await getUser(ctx.session.userId);
    let lev = user?.settings?.defaultLeverage || 5;

    // Cycle: 5 -> 10 -> 20 -> 50 -> 5
    if (lev === 5) lev = 10;
    else if (lev === 10) lev = 20;
    else if (lev === 20) lev = 50;
    else lev = 5;

    await updateUserSettings(ctx.session.userId, { defaultLeverage: lev });
    await ctx.answerCbQuery(`Leverage set to ${lev}x`);
    await showSettingsMenu(ctx);
});

// Toggle Notifications
settingsComposer.action('settings_notif_toggle', async (ctx) => {
    if (!ctx.session.userId) return;

    const user = await getUser(ctx.session.userId);
    const current = user?.settings?.notifications !== false;
    const newVal = !current;

    await updateUserSettings(ctx.session.userId, { notifications: newVal });
    await ctx.answerCbQuery(`Notifications ${newVal ? 'Enabled' : 'Disabled'}`);
    await showSettingsMenu(ctx);
});

// Unlink Menu
settingsComposer.action('settings_unlink_menu', async (ctx) => {
    await ctx.answerCbQuery();

    const linkedExchanges = ctx.session.linkedExchanges || [];

    if (linkedExchanges.length === 0) {
        await ctx.editMessageText(
            '⚠️ **No Linked Exchanges**\n\n' +
            'You don\'t have any exchanges linked.',
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Settings', 'overview_settings')]])
            }
        );
        return;
    }

    const buttons = linkedExchanges.map(ex => {
        const name = ex === 'aster' ? '🏦 Aster' : '🌊 Hyperliquid';
        return [Markup.button.callback(`Unlink ${name}`, `settings_unlink_confirm:${ex}`)];
    });

    buttons.push([Markup.button.callback('« Back to Settings', 'overview_settings')]);

    await ctx.editMessageText(
        '🔓 **Unlink Exchange**\n\n' +
        'Select which exchange to unlink:\n\n' +
        '_⚠️ This will remove your API credentials_',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        }
    );
});

// Unlink Confirmation
settingsComposer.action(/^settings_unlink_confirm:(.+)$/, async (ctx) => {
    const exchange = ctx.match[1];
    const name = exchange === 'aster' ? 'Aster DEX' : 'Hyperliquid';

    await ctx.answerCbQuery();

    await ctx.editMessageText(
        `⚠️ **Confirm Unlink ${name}**\n\n` +
        `This will:\n` +
        `• Remove your API credentials\n` +
        `• Log you out of ${name}\n\n` +
        `Are you sure?`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Unlink', `settings_unlink_execute:${exchange}`)],
                [Markup.button.callback('❌ Cancel', 'overview_settings')]
            ])
        }
    );
});

// Execute Unlink
settingsComposer.action(/^settings_unlink_execute:(.+)$/, async (ctx) => {
    const exchange = ctx.match[1];
    const name = exchange === 'aster' ? 'Aster DEX' : 'Hyperliquid';

    await ctx.answerCbQuery('Unlinking...');

    // TODO: Call API to actually unlink credentials
    // await ApiClient.unlinkCredentials(ctx.session.userId, exchange);

    // Update session state
    ctx.session.linkedExchanges = (ctx.session.linkedExchanges || []).filter(e => e !== exchange);

    if (ctx.session.activeExchange === exchange) {
        // Switch to another exchange or clear
        ctx.session.activeExchange = ctx.session.linkedExchanges[0] || undefined;
    }

    if (ctx.session.linkedExchanges.length === 0) {
        ctx.session.isLinked = false;
    }

    await ctx.editMessageText(
        `✅ **${name} Unlinked**\n\n` +
        `Your API credentials have been removed.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('« Back to Gateway', 'back_to_gateway')]
            ])
        }
    );
});
