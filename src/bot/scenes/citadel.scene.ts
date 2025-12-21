/**
 * Citadel Scene (Dashboard)
 * Displays account summary, active positions, and main navigation
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { showMenu, getUnlinkedKeyboard } from '../utils/menu';
import { getLinkedExchanges } from '../../db/users';

export const citadelScene = new Scenes.BaseScene<BotContext>('citadel');

// Global Commands
citadelScene.command(['menu', 'start'], async (ctx) => {
  await ctx.scene.leave();
  await showMenu(ctx);
});

// Enter handler
citadelScene.enter(async (ctx) => {
  if (!ctx.session.isLinked || !ctx.session.userId || !ctx.session.activeExchange) {
    await ctx.reply('⚠️ Connect your wallet or API key first.');
    return ctx.scene.leave();
  }

  await refreshDashboard(ctx);
});

// Refresh Dashboard Helper
async function refreshDashboard(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const exchange = ctx.session.activeExchange!;
  
  try {
    const message = await ctx.reply('⏳ Loading Citadel data...');
    
    // Fetch data from Universal API (Real Data)
    const account = await UniversalApiService.getAccountSummary(userId, exchange);
    
    // Format Balance
    const balance = parseFloat(account.totalBalance).toFixed(2);
    const available = parseFloat(account.availableBalance).toFixed(2);
    

    // Get linked exchanges to determine if switch button is needed
    const linkedExchanges = await getLinkedExchanges(userId);
    const canSwitch = linkedExchanges.length > 1;

    const dashboardMessageHeader = 
      `🏰 <b>CITADEL OVERVIEW</b>

<b>Exchange:</b> ${exchange.toUpperCase()}

💰 <b>Balance:</b> $${balance}
💵 <b>Available:</b> $${available}

<i>Select a position to manage or search for an asset.</i>`;

    // Positions as Text List (Clickable Commands)
    let positionList = '';
    const MAX_POSITIONS = 5;
    const positions = account.positions || [];
    
    if (positions.length > 0) {
        positionList = '\n\n<b>Active Positions:</b>\n';
        positionList += positions.slice(0, MAX_POSITIONS).map(pos => {
            const sideIcon = pos.side === 'LONG' ? '🟢' : '🔴';
            const rawPnl = parseFloat(pos.unrealizedPnl || '0'); // Fix NaN
            const pnl = isNaN(rawPnl) ? '0.00' : rawPnl.toFixed(2);
            const pnlSign = rawPnl >= 0 ? '+' : '';
            
            // Format: 🔴 /BTCUSDT 5x | PnL: +$10.50
            return `${sideIcon} /${pos.symbol} ${pos.leverage}x | PnL: ${pnlSign}$${pnl}`;
        }).join('\n\n');

        if (positions.length > MAX_POSITIONS) {
            positionList += `\n\n...and ${positions.length - MAX_POSITIONS} more. Use /orders to view all.`;
        }
    } else {
        positionList = '\n\n<i>No active positions.</i>';
    }

    const fullMessage = dashboardMessageHeader + positionList;

    // Compact 3-column layout (Main Actions Only)
    const mainRow = [
      Markup.button.callback('🔎 Trade', 'search_prompt'),
      Markup.button.callback('🌎 Assets', 'search_prompt'),
      Markup.button.callback('⚙️ Settings', 'settings')
    ];

    const secondaryRow = [
      Markup.button.callback('❓ Help', 'help'),
      Markup.button.callback('🔄 Refresh', 'refresh')
    ];

    if (canSwitch) {
      secondaryRow.push(Markup.button.callback('🔁 Switch', 'switch_exchange'));
    }

    const keyboard = Markup.inlineKeyboard([
      mainRow,
      secondaryRow
    ]);

    // Update message
    try {
        await ctx.telegram.editMessageText(
        ctx.chat!.id,
        message.message_id,
        undefined,
        fullMessage,
        { parse_mode: 'HTML', ...keyboard }
        );
    } catch (e: any) {
         // Fallback if edit fails (e.g. content same)
         console.warn('Edit failed (likely same content):', e.message);
    }
    
  } catch (error: any) {
    console.error('Citadel Error:', error);
    await ctx.reply(`❌ Failed to load Citadel: ${error.message}`, 
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Retry', 'refresh')],
        [Markup.button.callback('🗝 Unlink Wallet', 'reset_wallet')]
      ])
    );
  }
}

// View All Orders & Positions
import { showActiveOrdersTypes } from '../utils/orders';
citadelScene.command('orders', async (ctx) => {
    await showActiveOrdersTypes(ctx);
});

// Handle Slash Command for Trading (e.g., /BTCUSDT)
// Captures ANY slash command mostly, so we must filter reserved ones
citadelScene.hears(/^\/([A-Z0-9]+)$/i, async (ctx) => {
    const symbol = ctx.match[1].toUpperCase();

    // Ignore system commands and common keywords
    const reserved = [
        'START', 'MENU', 'HELP', 'SETTINGS', 'ORDERS', 
        'MARKET', 'LIMIT', 'TRADE', 'CANCEL', 'SEARCH', 'REFRESH'
    ];
    if (reserved.includes(symbol)) return;

    await ctx.scene.enter('trading', { symbol });
});

// Emergency Unlink Action
citadelScene.action('reset_wallet', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('unlink');
});

// Actions
citadelScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery();
  await refreshDashboard(ctx);
});

citadelScene.action('search_prompt', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🔍 **Search Asset**\n\nType the symbol you want to trade (e.g., `BTC`, `ETH`, `SOL`)');
  // We stay in the scene and listen for text
});

citadelScene.action('switch_exchange', async (ctx) => {
  const current = ctx.session.activeExchange;
  const target = current === 'aster' ? 'hyperliquid' : 'aster';
  
  ctx.session.activeExchange = target;
  await ctx.answerCbQuery(`Switched to ${target.toUpperCase()}`);
  await refreshDashboard(ctx);
});

citadelScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.scene.enter('settings');
});

// Cancel Specific Order Action
citadelScene.action(/cancel_order_(.+)/, async (ctx) => {
    // Format: cancel_order_ORDERID_SYMBOL
    // Regex captures "ORDERID_SYMBOL" in match[1]
    const rawData = ctx.match[1];
    const parts = rawData.split('_');
    const symbol = parts.pop(); // Last part is symbol
    const orderId = parts.join('_'); // Rest is Order ID
    
    const userId = ctx.session.userId!;
    const exchange = ctx.session.activeExchange!;
    
    await ctx.answerCbQuery();
    await ctx.reply(`⚠️ Cancelling order <code>${orderId}</code> for ${symbol}...`, { parse_mode: 'HTML' });
    
    try {
        if (!symbol) throw new Error('Symbol missing in callback');

        await UniversalApiService.cancelOrder(userId, exchange, orderId, symbol);
        await ctx.reply(`✅ Order cancelled.`);
        
        // Refresh list
        const { showActiveOrdersTypes } = await import('../utils/orders');
        await showActiveOrdersTypes(ctx);

    } catch (error: any) {
        await ctx.reply(`❌ Failed to cancel: ${error.message}`);
    }
});

// Self-refresh for orders list
citadelScene.action('orders', async (ctx) => {
    await ctx.answerCbQuery();
    const { showActiveOrdersTypes } = await import('../utils/orders');
    await showActiveOrdersTypes(ctx);
});

citadelScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('📚 **Help**\n\nUse this dashboard to monitor your portfolio.\nType any symbol to start trading.');
});

// Handle text input (Search)
citadelScene.on('text', async (ctx) => {
  const query = ctx.message.text.trim().toUpperCase();
  
  if (query.startsWith('/')) {
    // Let global commands handle it (like /start, /menu)
    // But we need to leave the scene first if it's a known command that switches context
    // For now, let's just ignore or process search
    return; 
  }

  // Check for Natural Language Trade Command
  const { parseTradeCommand } = await import('../utils/parser');
  const tradeIntent = parseTradeCommand(ctx.message.text);

  if (tradeIntent) {
      // Handle explicit exchange switch
      if (tradeIntent.exchange && tradeIntent.exchange !== ctx.session.activeExchange) {
        const { getLinkedExchanges } = await import('../../db/users');
        const linked = await getLinkedExchanges(ctx.session.userId!);
        
        if (linked.includes(tradeIntent.exchange)) {
            ctx.session.activeExchange = tradeIntent.exchange;
            await ctx.reply(`🔄 Switched to ${tradeIntent.exchange.toUpperCase()}`);
        } else {
             await ctx.reply(`⚠️ You are not linked to ${tradeIntent.exchange.toUpperCase()}. Using ${ctx.session.activeExchange?.toUpperCase()}.`);
        }
      }

      await ctx.scene.enter('trading', { 
          symbol: tradeIntent.symbol,
          side: tradeIntent.side,
          mode: tradeIntent.type,
          amount: tradeIntent.amount,
          price: tradeIntent.price
      });
      return;
  }

  // Basic validation for Search (only if not a command)
  if (query.length < 2 || query.length > 10) {
    await ctx.reply('⚠️ Invalid symbol. Please try again (e.g. "BTC")');
    return;
  }

  // Search using Universal API
  try {
    const assets = await UniversalApiService.searchAssets(ctx.session.activeExchange!, query);
    
    if (assets.length === 0) {
      await ctx.reply(`❌ No assets found for "${query}"`);
      return;
    }

    // Show results
    const buttons = assets.map(asset => [
      Markup.button.callback(`${asset.symbol} ($${asset.quoteAsset})`, `trade_${asset.symbol}`)
    ]);
    
    buttons.push([Markup.button.callback('❌ Cancel', 'cancel_search')]);

    await ctx.reply(
      `🔍 **Search Results for "${query}"**`,
      Markup.inlineKeyboard(buttons)
    );
    
  } catch (error: any) {
    await ctx.reply(`❌ Search failed: ${error.message}`);
  }
});

// Handle trade selection
citadelScene.action(/trade_(.+)/, async (ctx) => {
  const symbol = ctx.match[1];
  await ctx.answerCbQuery();
  
  // Transition to Trading Scene (Module 2)
  return ctx.scene.enter('trading', { symbol });
});

citadelScene.action('cancel_search', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
});
