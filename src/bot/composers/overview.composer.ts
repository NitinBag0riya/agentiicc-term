import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

import { ApiClient } from '../../services/apiClient';
import { getLinkedExchanges, getUser, updateUserSettings } from '../../db/users';

import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

export const overviewComposer = new Composer<BotContext>();

// Helper to format position (simplified from legacy)
function formatPosition(p: any, style: string): string {
    const symbol = p.symbol;
    const size = parseFloat(p.size);
    const pnl = parseFloat(p.unrealizedPnl);
    const entry = parseFloat(p.entryPrice);
    const mark = parseFloat(p.markPrice);
    const liq = p.liquidationPrice ? parseFloat(p.liquidationPrice) : 0;
    const leverage = p.leverage || '1';

    const emoji = pnl >= 0 ? '📈' : '📉';
    const sign = pnl >= 0 ? '+' : '';

    // Format: /BTC (clickable) with styles
    // User requested: "so ETH is not embedded and not clickable wheras it should be clikable... like /btc"
    const command = `/${symbol}`;

    if (style === 'style1' || style === 'style2') {
        return `${command} <b>${symbol}</b> (${leverage}x) ${emoji}\nPnL: <b>${sign}$${pnl.toFixed(2)}</b>\nSize: ${size} | Entry: $${entry.toFixed(2)} | Mark: $${mark.toFixed(2)}\nLiq: ${liq > 0 ? '$' + liq.toFixed(2) : 'N/A'}\n\n`;
    }

    return `${command} <b>${symbol}</b> ${p.side} ${leverage}x ${emoji}\nSize: ${size} | PnL: ${sign}$${pnl.toFixed(2)}\nEntry: ${entry.toFixed(4)} | Mark: ${mark.toFixed(4)}\n\n`;
}

export async function showOverview(ctx: BotContext, editMessage = false, style: 'default' | 'style1' | 'style2' = 'default') {
    const { userId, authToken, activeExchange } = ctx.session;

    if (!authToken || !activeExchange) {
        await ctx.reply('❌ Please /link an exchange first.');
        return;
    }

    let messageToEdit;
    if (editMessage && ctx.callbackQuery?.message) {
        messageToEdit = ctx.callbackQuery.message;
        await ctx.editMessageText('⏳ Fetching account data...');
    } else {
        messageToEdit = await ctx.reply('⏳ Fetching account data...');
    }

    try {
        const res = await ApiClient.getAccount(authToken, activeExchange);

        if (!res.success || !res.data) {
            throw new Error(res.error || 'Failed to fetch data');
        }

        const data = res.data; // AccountInfo
        const exchangeName = activeExchange === 'aster' ? 'Aster DEX' : 'Hyperliquid';

        const exchangeTitle = exchangeName === 'Aster DEX' ? '🏦 Command Citadel ⚡ AsterDEX' : '🌊 Command Citadel ⚡ Hyperliquid';
        let message = `<b>${exchangeTitle}</b>\n\n`;

        // ================= PERP PORTFOLIO =================
        const activePositions = (data.positions || []).filter((p: any) => parseFloat(p.size) !== 0);

        // Calculate Perp Stats
        const perpBalance = data.totalBalance ? parseFloat(data.totalBalance) : 0; // This is usually total wallet balance handling both? 
        // For Aster/Hyperliquid unified API, getAccount usually returns total wallet value.
        // But user wants separation. Let's assume for now Total Balance = Perp + Spot unavailable?
        // Actually, user sample shows: "Perp Portfolio: balance $14.97 | uPnL...".
        // And "Spot Portfolio: Balance $9.05".
        // The API `data` structure has `totalBalance` and `availableBalance`.
        // It also has `balances` (spot).
        // Let's try to derive Spot Value from `balances` and subtract from Total to get Perp? Or usage matches API.

        // Calculate Spot Value
        let spotValue = 0;
        let spotAssets: any[] = [];
        if (data.balances) {
            spotAssets = data.balances
                .filter((b: any) => parseFloat(b.total) > 0 && b.asset !== 'USDT' && b.asset !== 'USDC')
                .sort((a: any, b: any) => parseFloat(b.total) - parseFloat(a.total))
                .slice(0, 15);

            // Rough estimate if we don't have prices: assume 0 for now or user provided sample shows balance.
            // The API might not return spot value directly. 
            // We can use the 'balances' list. 
            // Sample shows balance $9.05.
            // We will assume for now we don't have live spot prices in this Composer unless we fetch ticker.
            // We will just show "Spot Balance: [Sum of USDT/USDC]" if available?
            // Or better: The User sample "Spot available $4.22 USDT". 
            // Let's use `availableBalance` as "Perp available" maybe?
        }

        // Logic for Display:
        // Perp Section - Use API aggregate totals when available, fallback to sum
        const totalUpnl = parseFloat(data.totalUnrealizedProfit || '0') ||
            activePositions.reduce((acc: number, p: any) => acc + parseFloat(p.unrealizedPnl || '0'), 0);
        const upnlSign = totalUpnl >= 0 ? '+' : '';
        const upnlEmoji = totalUpnl >= 0 ? '📈' : '📉';
        const totalMargin = parseFloat(data.totalPositionInitialMargin || '0') ||
            activePositions.reduce((acc: number, p: any) => acc + parseFloat(p.initialMargin || '0'), 0);

        // Calculate PnL% based on wallet balance (avoid division by zero)
        const totalBalance = parseFloat(data.totalBalance) || 0;
        const pnlPercent = totalBalance > 0 ? (totalUpnl / totalBalance) * 100 : 0;
        const pnlPercentSign = pnlPercent >= 0 ? '+' : '';

        message += `📊 <b>Perp Portfolio:</b>\n`;
        message += `Balance: <b>$${totalBalance.toFixed(2)}</b> | uPnL: <b>${upnlSign}$${totalUpnl.toFixed(2)}</b> (${pnlPercentSign}${pnlPercent.toFixed(2)}%)\n`;
        message += `Margin Used: <b>$${totalMargin.toFixed(2)}</b>\n`;

        if (activePositions.length > 0) {
            const displayPositions = activePositions.slice(0, 10);
            displayPositions.forEach((p: any) => {
                message += formatPosition(p, style);
            });
            if (activePositions.length > 10) {
                message += `... and ${activePositions.length - 10} more positions.\n`;
            }
        } else {
            message += `None\n`;
        }
        message += '\n';

        // ================= SPOT PORTFOLIO =================
        // Calculate Spot Balance (Sum of USDT/USDC in balances?)
        // Or just display list. User sample: "Balance: $9.05".
        // We might not have this computed value from API directly if `totalBalance` is global.
        // Let's assume `data.totalBalance` is the Account Balance.
        // And Spot Balance is a separate calc.
        // For MVP refactor, I will display "Spot Assets" and list them.

        message += `💼 <b>Spot Portfolio:</b>\n`;
        // message += `Balance: $???\n`; // Placeholder or need calculation

        if (spotAssets.length > 0) {
            spotAssets.forEach((b: any) => {
                // Mimic format: /FORMUSDT N/A | 0.075 FORM
                message += `/${b.asset}USDT N/A | ${parseFloat(b.total).toFixed(4)} ${b.asset}\n`;
            });
            const hiddenCount = (data.balances || []).length - spotAssets.length; // Approximate
            if (hiddenCount > 0) message += `... +${hiddenCount} others\n`;
        } else {
            message += `None\n`;
        }
        message += '\n';

        // ================= SUMMARY =================
        // "Spot available $4.22 USDT | Perp available $14.97 Margin"
        const spotAvailable = (data.balances || []).find((b: any) => b.asset === 'USDT' || b.asset === 'USDC')?.free || '0';
        message += `Spot available $${parseFloat(spotAvailable).toFixed(2)} USDT | Perp available $${parseFloat(data.availableBalance).toFixed(2)} Margin\n\n`;

        message += `Account Balance: <b>$${parseFloat(data.totalBalance).toFixed(2)}</b>\n`;

        // ================= BUTTONS =================
        const buttons = [
            [
                Markup.button.callback('Trade Spot', 'menu_trade_spot'),
                Markup.button.callback('Trade Perps', 'menu_trade_perps')
            ],
            [
                Markup.button.callback('📊 All Perps', 'positions_list'),
                Markup.button.callback('🔄 Refresh', 'view_account')
            ]
        ];
        // Smart Switch Logic
        // If only 2 exchanges (Aster/Hyperliquid), toggle between them.
        // If more, maybe go back to Gateway? For now, User requested "Switch exchange button should call directly /aster if currently hyperliquid".

        let switchButton;
        if (activeExchange === 'aster') {
            switchButton = Markup.button.callback('⚡ Switch to Hyperliquid', 'switch_to_hyperliquid');
        } else {
            switchButton = Markup.button.callback('⚡ Switch to Aster', 'switch_to_aster');
        }

        buttons.push([Markup.button.callback('🔄 Refresh', 'view_account')]);
        buttons.push([switchButton]); // Smart Switch
        buttons.push([Markup.button.callback('« Gateway', 'back_to_gateway')]);
        buttons.push([Markup.button.callback('⚙️ Settings', 'overview_settings')]);

        // Settings Handler
        overviewComposer.action('overview_settings', async (ctx) => {
            await ctx.answerCbQuery();

            if (!ctx.session.userId) {
                return ctx.reply('❌ Please start with /start first');
            }

            const user = await getUser(ctx.session.userId);
            const settings = user?.settings || {};
            const leverage = settings.defaultLeverage || 5;
            const notifs = settings.notifications !== false; // Default true

            const msg = `⚙️ **Settings Menu**\n\n` +
                `**Default Leverage:** ${leverage}x\n` +
                `**Notifications:** ${notifs ? '✅ ON' : '❌ OFF'}\n\n` +
                `Select a setting to change:`;

            await ctx.editMessageText(msg, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Lev: ${leverage}x`, 'settings_lev_cycle'),
                        Markup.button.callback(`Notifs: ${notifs ? 'ON' : 'OFF'}`, 'settings_notif_toggle')
                    ],
                    [Markup.button.callback('« Back', 'view_account')]
                ])
            });
        });

        // Toggle Leverage
        overviewComposer.action('settings_lev_cycle', async (ctx) => {
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
            // Trigger refresh by calling the main settings handler handler logic again or just re-render
            // Ideally we re-call the handler logic, but we can't easily invoke handlers.
            // So we re-render the menu.
            // ... (Duplicate logic or refactor? For now I'll just trigger the action 'overview_settings' via a fake update if possible? No.)
            // I'll just call the view again manually.
            const settings = { ...user?.settings, defaultLeverage: lev };
            const notifs = settings.notifications !== false;

            const msg = `⚙️ **Settings Menu**\n\n` +
                `**Default Leverage:** ${lev}x\n` +
                `**Notifications:** ${notifs ? '✅ ON' : '❌ OFF'}\n\n` +
                `Select a setting to change:`;

            await ctx.editMessageText(msg, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Lev: ${lev}x`, 'settings_lev_cycle'),
                        Markup.button.callback(`Notifs: ${notifs ? 'ON' : 'OFF'}`, 'settings_notif_toggle')
                    ],
                    [Markup.button.callback('« Back', 'view_account')]
                ])
            });
        });

        // Toggle Notifications
        overviewComposer.action('settings_notif_toggle', async (ctx) => {
            if (!ctx.session.userId) return;
            const user = await getUser(ctx.session.userId);
            const current = user?.settings?.notifications !== false;
            const newVal = !current;

            await updateUserSettings(ctx.session.userId, { notifications: newVal });
            await ctx.answerCbQuery(`Notifications ${newVal ? 'Enabled' : 'Disabled'}`);

            // Re-render
            const lev = user?.settings?.defaultLeverage || 5;
            const msg = `⚙️ **Settings Menu**\n\n` +
                `**Default Leverage:** ${lev}x\n` +
                `**Notifications:** ${newVal ? '✅ ON' : '❌ OFF'}\n\n` +
                `Select a setting to change:`;

            await ctx.editMessageText(msg, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Lev: ${lev}x`, 'settings_lev_cycle'),
                        Markup.button.callback(`Notifs: ${newVal ? 'ON' : 'OFF'}`, 'settings_notif_toggle')
                    ],
                    [Markup.button.callback('« Back', 'view_account')]
                ])
            });
        });
        // User said: "select exchange button should call directly /aster...". 
        // I'll replace the main "Switch Exchange" with the smart toggle.
        // I'll keep "Gateway" as a secondary option in case they want to link/unlink.

        // Actually, user said "instead of going back to /start". 
        // So I will prioritize the direct switch.

        if (editMessage) {
            await ctx.telegram.editMessageText(
                messageToEdit.chat.id,
                messageToEdit.message_id,
                undefined,
                message,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
            );
        } else {
            // Delete loading message and send new one (cleaner than edit if type changed) or just edit
            await ctx.telegram.editMessageText(
                messageToEdit.chat.id,
                messageToEdit.message_id,
                undefined,
                message,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
            );
        }

    } catch (error: any) {
        const errText = `❌ Error: ${error.message}`;
        if (editMessage) {
            await ctx.editMessageText(errText);
        } else {
            await ctx.telegram.editMessageText(messageToEdit.chat.id, messageToEdit.message_id, undefined, errText);
        }
    }
}

// Action handlers
overviewComposer.action(['view_account', 'menu'], async (ctx) => {
    await ctx.answerCbQuery('🔄 Refreshing...');
    await showOverview(ctx, true);
});

overviewComposer.action('back_to_gateway', async (ctx) => {
    await ctx.answerCbQuery('Taking you back to the gateway protocol');
    // Handled in start.composer.ts mostly, but we trigger the navigation
    // We can't trigger showGateway from here easily w/o export. 
    // Wait, I didn't export showGateway in start.composer yet... 
    // But I added the handler in start.composer.ts!
    // So if I click the button 'back_to_gateway', it will bubble up to start.composer.ts if I don't handle it here?
    // middleware chain: start -> overview.
    // YES. If I remove the handler here, startComposer might catch it?
    // startComposer is .use(startComposer) then .use(overviewComposer).
    // If I click inside overview, the update comes in. 
    // Telegraf iterates middleware.
    // If startComposer defines action('back_to_gateway'), it should catch it.
    // so I DON'T need to define it here.
    // Safest matches: remove handler here.
});

overviewComposer.action('settings', async (ctx) => {
    await ctx.answerCbQuery('Settings 🚧');
});

// Positions List - Show all perp positions
overviewComposer.action('positions_list', async (ctx) => {
    await ctx.answerCbQuery('Loading positions...');

    const { authToken, activeExchange } = ctx.session;

    if (!authToken) {
        await ctx.reply('❌ Session expired. /start');
        return;
    }

    try {
        const res = await ApiClient.getAccount(authToken, activeExchange);

        if (!res.success || !res.data) {
            throw new Error(res.error || 'Failed to fetch data');
        }

        const positions = (res.data.positions || []).filter((p: any) => parseFloat(p.size) !== 0);

        if (positions.length === 0) {
            await ctx.reply(
                '📊 **All Perp Positions**\n\n' +
                '_No active positions_\n\n' +
                'Search for a symbol to open a new position.',
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('« Back to Citadel', 'view_account')]
                    ])
                }
            );
            return;
        }

        let message = '📊 **All Perp Positions**\n\n';

        for (const p of positions) {
            const pnl = parseFloat(p.unrealizedPnl);
            const emoji = pnl >= 0 ? '📈' : '📉';
            const sign = pnl >= 0 ? '+' : '';
            const symbol = p.symbol;
            const size = parseFloat(p.size);
            const leverage = p.leverage || '1';

            message += `/${symbol.replace(/USDT$/, '')} **${symbol}** (${leverage}x) ${emoji}\n`;
            message += `Size: ${size} | PnL: ${sign}$${pnl.toFixed(2)}\n\n`;
        }

        message += `\n_Click a position to manage_`;

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Refresh', 'positions_list')],
                [Markup.button.callback('« Back to Citadel', 'view_account')]
            ])
        });

    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`, {
            ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'view_account')]])
        });
    }
});
