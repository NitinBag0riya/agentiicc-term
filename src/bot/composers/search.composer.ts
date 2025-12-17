import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

export const searchComposer = new Composer<BotContext>();

searchComposer.on('text', async (ctx, next) => {
    // 1. Filter: Ignore commands, wizards, unlinked users, or waiting input
    if (ctx.message.text.startsWith('/')) return next();
    if (ctx.scene?.current) return next();
    // if (ctx.session.waitingForInput) return next(); // Not using this yet, but good practice
    if (!ctx.session.isLinked) return next();

    const query = ctx.message.text.trim().toUpperCase();
    if (query.length < 2) return next(); // Ignore single chars

    // 2. Search via API
    try {
        const { authToken } = ctx.session;
        if (!authToken) return next();

        const res = await ApiClient.searchAssets(authToken, query);
        if (!res.success || !res.data || res.data.length === 0) {
            // Optional: convert to silent catch or reply "No results"
            // Legacy replied "No symbols found" with back button.
            // Let's implement that behavior for better UX.
            await ctx.reply(
                `🔍 **No symbols found for "${query}"**\n\nTry searching for:\n• Asset names: BTC, ETH\n• Full symbols: BTCUSDT, ETHUSDT`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const assets = res.data;
        const spot = assets.filter((a: any) => !a.contractType && !a.symbol.includes('PERP')); // Basic heuristic for now
        // Or better: Server returns 'exchange' and we know Aster has spot/perp.
        // Actually server returns mixed list.
        // Let's rely on standard filtering: 
        // If it has 'contractSize' or 'maxLeverage' it is Perp.
        // The server response structure depends on the adapter.
        // Let's assume the server standardizes this or returns 'type'.

        // REVISIT: The server endpoint merges Aster (Spot) and HL (Perp).
        // Aster also has perps.
        // Let's filter by checking if it looks like a perp (e.g. ends in PERP or has perp property).
        // Since we don't have strict types here, let's look at the data shape or just show them all.

        // Grouping:
        // We'll just list them. If we can distinguish, great.

        let message = `🔍 **Search Results for "${query}"**\n\n`;
        const buttons: any[] = [];

        // LIMIT to 5 to avoid spam
        const topAssets = assets.slice(0, 5);

        for (const asset of topAssets) {
            // Fix: Check for 'perp' type from Adapter
            const isPerp = asset.symbol.endsWith('PERP') || asset.type === 'swap' || asset.type === 'perp' || asset.contractType;
            const typeTag = isPerp ? '⚡ Perp' : '💱 Spot';

            // Text Line: Make symbol clickable command /SYMBOL
            message += `• /${asset.symbol} (${typeTag})\n`;

            // Button Row
            const row = [];
            if (isPerp) {
                // Perp -> Manage Position Menu (New/Manage)
                row.push(Markup.button.callback(`⚡ ${asset.symbol}`, `goto_perp:${asset.symbol}`));
            } else {
                // Spot -> Buy Menu
                row.push(Markup.button.callback(`💱 ${asset.symbol}`, `goto_spot:${asset.symbol}`));
            }
            buttons.push(row);
        }

        message += `\n_Select an asset to trade:_`;

        await ctx.reply(message, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });

    } catch (e) {
        console.error('Search Error', e);
        // Silent fail or next() to let other handlers try?
        return next();
    }
});

// Actions for results
searchComposer.action(/^goto_perp:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    // Trigger the command handler logic by calling showPositionMenu directly?
    // We can't import showPositionMenu easily if it's not exported or circular.
    // Ideally we emit a text command or call a shared service.
    // Or we just re-use the function if we can import it.
    // Let's try emitting a slash command logic or use a shared helper.
    // For now, let's use the execute-command trick or import `showPositionMenu`.

    // Importing dynamically to avoid circle
    const { showPositionMenu } = await import('./position.composer');
    await showPositionMenu(ctx, symbol);
});

searchComposer.action(/^goto_spot:(.+)$/, async (ctx) => {
    const symbol = ctx.match[1];
    await ctx.answerCbQuery();
    // Enter spot buy wizard
    await ctx.scene.enter('spot-buy', { symbol, side: 'BUY' });
});
