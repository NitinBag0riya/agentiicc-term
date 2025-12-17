import { Composer, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { ApiClient } from '../../services/apiClient';

export const tradeComposer = new Composer<BotContext>();

const ITEMS_PER_PAGE = 10;

// ================== HELPER: Show Asset List ==================
async function showAssetList(ctx: BotContext, type: 'spot' | 'perp', page: number = 0, isEdit: boolean = false) {
    const { authToken, activeExchange } = ctx.session;
    if (!authToken || !activeExchange) {
        return ctx.reply('❌ Session expired. Please /start again.');
    }

    // 1. Fetch Assets
    // We use getAssets from API.
    // For 'spot', we filter for Spot assets. For 'perp', we filter for Perp assets.
    // The API /assets might return all. 
    // We assume getAssets returns a list of tickers/assets.
    try {
        const res = await ApiClient.getAssets(authToken, activeExchange);
        if (!res.success || !res.data) {
            throw new Error(res.error || 'Failed to fetch assets');
        }

        let assets = res.data; // Expecting array of { symbol, type, ... } or similar
        // If API returns simple list, we adapt.
        // Assuming API returns: [{ start: string, symbol: string, ... }]

        // Filter based on type
        // 'spot' usually means pairs like 'ASTERUSDT' or just assets 'ASTER'.
        // 'perp' usually means 'ETH-PERP' or similar.

        // REFACTOR: User reported empty list because strict filtering failed.
        // Aster adapter returns FAPI assets (Perps) as "BTCUSDT".
        // Hyperliquid adapter returns Perps as "ETH" (normalized).
        // Neither explicitly contain "PERP" in the returned symbol property in all cases.
        // Since both adapters currently serve Perps primarily (Aster is FAPI), we will show ALL assets for 'perp'.
        // For 'spot', we will also show ALL assets for now to ensure visibility as requested ("trade spots must display all spot symbols").
        // We will add a visual indicator if possible, or just list them.

        // Current Strategy: Permissive. Show everything.
        // In future, check `a.type` if available.

        // if (type === 'spot') {
        //      assets = assets.filter((a: any) => !a.symbol.includes('-PERP') && !a.symbol.includes('PERP'));
        // } else {
        //      assets = assets.filter((a: any) => a.symbol.includes('-PERP') || a.symbol.includes('PERP') || a.type === 'perp');
        // }

        // Just dedup if needed (some APIs return duplicates)
        assets = [...new Set(assets)];

        // Sort by Volume (Descending)
        // If volume is missing (e.g. '0'), it goes to bottom
        assets.sort((a: any, b: any) => {
            const volA = parseFloat(a.volume24h || '0');
            const volB = parseFloat(b.volume24h || '0');
            return volB - volA; // High to Low
        });

        const totalAssets = assets.length;
        const totalPages = Math.ceil(totalAssets / ITEMS_PER_PAGE);

        // Adjust page if out of bounds
        if (page < 0) page = 0;
        if (page >= totalPages && totalPages > 0) page = totalPages - 1;

        const startIdx = page * ITEMS_PER_PAGE;
        const pageAssets = assets.slice(startIdx, startIdx + ITEMS_PER_PAGE);

        const typeTitle = type === 'spot' ? 'Spot' : 'Perp';
        let message = `📊 **Trade ${typeTitle} - Select Asset**\n`;
        message += `Exchange: ${activeExchange.toUpperCase()}\n`;
        message += `Page: ${page + 1}/${totalPages || 1}\n\n`;

        // 2. Build Buttons
        const buttons = [];

        // Asset Buttons (Grid of 2)
        const assetButtons = pageAssets.map((a: any) => {
            return Markup.button.callback(a.symbol, `trade_select_${type}_${a.symbol}`);
        });

        for (let i = 0; i < assetButtons.length; i += 2) {
            buttons.push(assetButtons.slice(i, i + 2));
        }

        // Pagination
        const navButtons = [];
        if (page > 0) navButtons.push(Markup.button.callback('⬅️ Previous', `trade_page_${type}_${page - 1}`));
        if (page < totalPages - 1) navButtons.push(Markup.button.callback('Next ➡️', `trade_page_${type}_${page + 1}`));

        if (navButtons.length > 0) buttons.push(navButtons);

        // Back
        buttons.push([Markup.button.callback('« Back to Citadel', 'view_account')]);

        if (isEdit) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        }

    } catch (error: any) {
        console.error('Trade Menu Error:', error);
        await ctx.answerCbQuery('❌ Failed to load assets');
    }
}

// ================== HANDLERS ==================

// 1. Entry Points
tradeComposer.action('menu_trade_spot', async (ctx) => {
    await ctx.answerCbQuery('Loading Spot Markets...');
    await showAssetList(ctx, 'spot', 0, true);
});

tradeComposer.action('menu_trade_perps', async (ctx) => {
    await ctx.answerCbQuery('Loading Perp Markets...');
    await showAssetList(ctx, 'perp', 0, true);
});

// 2. Pagination
tradeComposer.action(/^trade_page_(spot|perp)_(\d+)$/, async (ctx) => {
    const type = ctx.match[1] as 'spot' | 'perp';
    const page = parseInt(ctx.match[2]);
    await ctx.answerCbQuery(`Page ${page + 1}`);
    await showAssetList(ctx, type, page, true);
});

// 3. Selection -> Wizard
tradeComposer.action(/^trade_select_(spot|perp)_(.+)$/, async (ctx) => {
    const type = ctx.match[1];
    const symbol = ctx.match[2];

    await ctx.answerCbQuery(`Selected ${symbol}`);

    // Enter the appropriate wizard / menu
    // We already have 'spot-buy' wizard.
    // For perps, we utilize the new Position Management Menu (Context Aware).
    // User requested "Clicking asset -> Opens Trade Wizard (Spot/Perp)".

    // Import dynamically if needed to avoid circular, or just rely on the fact that we can import from position.composer
    // We need to import `showPositionMenu` at top or use it here.
    // Since we can't easily add top-level imports in this tool without reading whole file, 
    // I will assume I can add import at top in a separate step or just use a dynamic import/require?
    // Typescript dynamic import: await import(...).
    // Let's try dynamic import to be safe and clean.

    if (type === 'spot') {
        // Legacy flow used 'spot-buy' scene?
        // Let's pass the symbol.
        await ctx.scene.enter('spot-buy', { symbol });
    } else {
        // PERP FLOW: Show New/Manage Position Menu
        // This solves "Failed to fetch ticker" in spot-buy scene for perps
        // And fulfills "clicking it takes us to New position menu"

        try {
            const { showPositionMenu } = await import('./position.composer');
            await showPositionMenu(ctx, symbol);
        } catch (e) {
            console.error('Failed to load position menu:', e);
            await ctx.reply('❌ Error loading position menu.');
        }
    }
});
