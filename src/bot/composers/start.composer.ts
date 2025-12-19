import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';
import { showOverview } from './overview.composer';
import { showPositionMenu } from './position.composer';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

export const startComposer = new Composer<BotContext>();

// Helper to get emoji for exchange
const getExchangeEmoji = (exchange: string) => {
    switch (exchange) {
        case 'aster': return '🏦';
        case 'hyperliquid': return '🌊';
        default: return '💱';
    }
};

const getExchangeName = (exchange: string) => {
    switch (exchange) {
        case 'aster': return 'Aster DEX';
        case 'hyperliquid': return 'Hyperliquid';
        default: return exchange.toUpperCase();
    }
};

// ================== /start Handler with Deep Link Routing ==================
startComposer.command('start', async (ctx) => {
    const payload = ctx.payload?.trim();

    // Deep link routing
    if (payload && payload.length > 0) {
        // Ensure session is initialized first
        await ensureSession(ctx);

        // Pattern: position-<index>
        if (payload.startsWith('position-')) {
            const index = parseInt(payload.replace('position-', ''), 10);
            if (!isNaN(index) && ctx.session.authToken) {
                try {
                    const accRes = await ApiClient.getAccount(ctx.session.authToken, ctx.session.activeExchange);
                    if (accRes.success && accRes.data?.positions) {
                        const positions = accRes.data.positions.filter((p: any) => parseFloat(p.size) !== 0);
                        if (index >= 0 && index < positions.length) {
                            const symbol = positions[index].symbol;
                            await showPositionMenu(ctx, symbol);
                            return;
                        }
                    }
                } catch (e) {
                    console.error('[Deep Link] Position index error:', e);
                }
            }
            await ctx.reply('❌ Position not found. Use /start to see your portfolio.');
            return;
        }

        // Pattern: Symbol name (e.g., ETHUSDT, BTC, ETH)
        if (/^[A-Z]{2,10}(USDT)?$/i.test(payload)) {
            const symbol = payload.toUpperCase();
            // Add USDT suffix if not present (for perp symbols)
            const fullSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
            await showPositionMenu(ctx, fullSymbol);
            return;
        }
    }

    // Default: Show gateway
    await showGateway(ctx);
});

// Helper to ensure session is initialized
async function ensureSession(ctx: BotContext) {
    if (!ctx.session.userId) {
        const userRes = await ApiClient.createUser(ctx.from!.id, ctx.from!.username);
        if (userRes.success && userRes.data) {
            ctx.session.userId = userRes.data.id;
        }
    }
    if (ctx.session.userId && !ctx.session.authToken) {
        const sRes = await ApiClient.createSession(ctx.session.userId);
        if (sRes.success) {
            ctx.session.authToken = sRes.token;
            ctx.session.activeExchange = sRes.activeExchange;
            ctx.session.linkedExchanges = sRes.linkedExchanges;
            ctx.session.isLinked = (sRes.linkedExchanges?.length || 0) > 0;
        }
    }
}

// ================== Shortcut Handlers ==================
startComposer.command('aster', async (ctx) => {
    await handleShortcut(ctx, 'aster');
});

startComposer.command('hyperliquid', async (ctx) => {
    await handleShortcut(ctx, 'hyperliquid');
});

async function handleShortcut(ctx: BotContext, exchange: string) {
    const { authToken } = ctx.session;
    // Ensure session exists
    if (!authToken) {
        // Try creating session first if user exists? 
        if (!ctx.session.userId) {
            const userRes = await ApiClient.createUser(ctx.from!.id, ctx.from!.username);
            if (userRes.success && userRes.data) ctx.session.userId = userRes.data.id;
        }
        if (ctx.session.userId) {
            const sRes = await ApiClient.createSession(ctx.session.userId);
            if (sRes.success) ctx.session.authToken = sRes.token;
        }
    }

    if (!ctx.session.authToken) {
        return ctx.reply('❌ Please use /start to initialize and link your account first.');
    }

    try {
        await ctx.reply(`🚀 Switching to ${exchange.toUpperCase()}...`);
        await ApiClient.switchExchange(ctx.session.authToken, exchange);
        ctx.session.activeExchange = exchange;
        await showOverview(ctx);
    } catch (e) {
        await ctx.reply(`❌ Failed to switch to ${exchange}. Please try via /start.`);
    }
}

// ================== Back to Gateway Handler ==================
startComposer.action('back_to_gateway', async (ctx) => {
    await ctx.answerCbQuery('Taking you back to the gateway protocol');
    await showGateway(ctx, true);
});

// ================== Switch Exchange Handler ==================
startComposer.action(/^switch_to_(.+)$/, async (ctx) => {
    const targetExchange = ctx.match[1];
    const { authToken } = ctx.session;

    if (!authToken) {
        await ctx.answerCbQuery('❌ No active session');
        return;
    }

    try {
        await ctx.answerCbQuery(`Entering ${targetExchange.toUpperCase()}...`);

        // Call API to switch session context
        await ApiClient.switchExchange(authToken, targetExchange);

        // Update local session
        ctx.session.activeExchange = targetExchange;

        // Redirect to Command Citadel (Overview)
        await showOverview(ctx, true);

    } catch (error) {
        console.error('Switch Failed:', error);
        await ctx.answerCbQuery('❌ Failed to switch exchange');
    }
});


// Core Function: Show Gateway
async function showGateway(ctx: BotContext, isEdit = false) {
    // 1. Ensure User & Session
    if (!ctx.session.userId) {
        const userRes = await ApiClient.createUser(ctx.from!.id, ctx.from!.username);
        if (userRes.success && userRes.data) {
            ctx.session.userId = userRes.data.id;
        } else {
            return ctx.reply('❌ System Error: Could not register user.');
        }
    }

    // Refresh Session Status
    const sessionRes = await ApiClient.createSession(ctx.session.userId);
    if (sessionRes.success) {
        ctx.session.authToken = sessionRes.token;
        ctx.session.linkedExchanges = sessionRes.linkedExchanges;
        ctx.session.isLinked = true;

        // Ensure activeExchange is set to something valid if possible
        if (!ctx.session.activeExchange && sessionRes.activeExchange) {
            ctx.session.activeExchange = sessionRes.activeExchange;
        }
    } else {
        ctx.session.isLinked = false;
        ctx.session.authToken = undefined;
        ctx.session.linkedExchanges = [];
    }

    // 2. Build Gateway UI and Fetch Data
    const { isLinked, linkedExchanges, authToken } = ctx.session;

    let message = '🌐 **Gateway Protocol**\n\n' +
        'Select a terminal to enter systems:\n\n';

    if (!isLinked || !linkedExchanges || linkedExchanges.length === 0) {
        message = '👋 **Welcome, Commander.**\n\n' +
            'System currently offline.\n' +
            'Establish a connection to begin.';

        const buttons = Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Link Exchange', 'start_link')]
        ]);

        if (isEdit && ctx.callbackQuery?.message) {
            return ctx.editMessageText(message, { parse_mode: 'Markdown', ...buttons });
        }
        // Cleanup old messages before new reply
        await cleanupButtonMessages(ctx);
        const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
        trackButtonMessage(ctx, sentMsg.message_id);
        return;
    }

    // Fetch Data for ALL linked exchanges
    const accountsData: any = {};
    let totalPortfolioValue = 0;

    if (authToken) {
        const promises = linkedExchanges.map(async (ex) => {
            const res = await ApiClient.getAccount(authToken, ex);
            if (res.success && res.data) {
                accountsData[ex] = res.data;
                totalPortfolioValue += parseFloat(res.data.totalBalance);
            }
        });
        // We wait for data since user explicitly requested it on landing
        await Promise.all(promises);
    }

    // Render Each Exchange
    linkedExchanges.forEach(ex => {
        const data = accountsData[ex];
        const emoji = getExchangeEmoji(ex);
        const name = getExchangeName(ex);

        message += `${emoji} **${name}**\n`;

        if (data) {
            const balance = parseFloat(data.totalBalance).toFixed(2);
            // Count open positions (size != 0)
            const openPositions = (data.positions || []).filter((p: any) => parseFloat(p.size) !== 0).length;

            message += `💰 Balance: $${balance} | 📊 Open Positions: ${openPositions}\n`;
        } else {
            message += `⚠️ Connection Error\n`;
        }
        message += '\n';
    });

    message += `━━━━━━━━━━━━━━━\n`;
    message += `💵 **Total Portfolio:** $${totalPortfolioValue.toFixed(2)}\n\n`;


    // 3. Render Exchange Buttons
    const buttons = [];

    // Exchange Buttons
    const exchangeButtons = linkedExchanges.map(ex => {
        const name = ex === 'aster' ? '🏦 Aster DEX' : (ex === 'hyperliquid' ? '🌊 Hyperliquid' : ex.toUpperCase());
        return Markup.button.callback(name, `switch_to_${ex}`);
    });

    // Chunk buttons into rows of 2
    for (let i = 0; i < exchangeButtons.length; i += 2) {
        buttons.push(exchangeButtons.slice(i, i + 2));
    }

    // Maintenance
    buttons.push([
        Markup.button.callback('🔗 Link New', 'start_link'),
        Markup.button.callback('🔓 Unlink', 'start_unlink')
    ]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (isEdit && ctx.callbackQuery?.message) {
        await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } else {
        // Cleanup old messages before new reply
        await cleanupButtonMessages(ctx);
        const sentMsg = await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
        trackButtonMessage(ctx, sentMsg.message_id);
    }
}
