import { Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

/**
 * Fetch and display all active positions and open orders for the current exchange
 */
export async function showActiveOrdersTypes(ctx: BotContext) {
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    
    await ctx.reply(`⏳ Loading active orders & positions for ${exchange}...`);

    try {
        const [positions, orders] = await Promise.all([
            UniversalApiService.getPositions(userId, exchange),
            UniversalApiService.getOpenOrders(userId, exchange)
        ]);

        let msg = `📋 <b>All Active Items (${exchange.toUpperCase()})</b>\n\n`;
        let hasContent = false;
        const buttons = [];

        // 1. Positions
        if (positions.length > 0) {
            hasContent = true;
            msg += `<b>---- POSITIONS (${positions.length}) ----</b>\n`;
            for (const p of positions) {
                 const rawPnl = parseFloat(p.unrealizedPnl || '0');
                 const pnlSign = rawPnl >= 0 ? '+' : '';
                 const sideIcon = p.side === 'LONG' ? '🟢' : '🔴';
                 
                 msg += `${sideIcon} <b>${p.symbol}</b> ${p.leverage}x | PnL: ${pnlSign}$${rawPnl.toFixed(2)}\n`;
                 
                 // Add "Manage Position" button
                 buttons.push([Markup.button.callback(`⚙️ Manage ${p.symbol}`, `trade_${p.symbol}`)]);
            }
            msg += '\n';
        }

        // 2. Open Orders
        if (orders.length > 0) {
             hasContent = true;
             msg += `<b>---- OPEN ORDERS (${orders.length}) ----</b>\n`;
             for (const o of orders) {
                 msg += `▫️ <b>${o.symbol}</b> ${o.side} ${o.type}\n   Qty: ${o.quantity} @ ${o.price}\n   ID: <code>${o.orderId}</code>\n\n`;
                 
                 // Add "Cancel Order" button
                 // Encodes symbol as last part: cancel_order_ID_SYMBOL
                 buttons.push([Markup.button.callback(`❌ Cancel ${o.side} ${o.symbol}`, `cancel_order_${o.orderId}_${o.symbol}`)]);
             }
        }

        if (!hasContent) {
            msg += `<i>No active positions or open orders.</i>`;
        }

        buttons.push([Markup.button.callback('🔄 Refresh', 'orders')]); // Self-referential refresh

        await ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });

    } catch (e: any) {
        await ctx.reply(`❌ Failed to load items: ${e.message}`);
    }
}
