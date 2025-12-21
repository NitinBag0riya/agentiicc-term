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

    const dashboardMessage = 
      `🏰 **CITADEL OVERVIEW**

**Exchange:** ${exchange.toUpperCase()}

💰 **Balance:** $${balance}
💵 **Available:** $${available}

_Select a position to manage or search for an asset._`;

    // Buttons: Positions as buttons
    const positionButtons = (account.positions || []).slice(0, 5).map(pos => {
        const sideIcon = pos.side === 'LONG' ? '🟢' : '🔴';
        const pnl = parseFloat(pos.unrealizedPnl).toFixed(2);
        const pnlSign = parseFloat(pos.unrealizedPnl) >= 0 ? '+' : '';
        return [Markup.button.callback(`${sideIcon} ${pos.symbol} ${pos.leverage}x | PnL: ${pnlSign}$${pnl}`, `trade_${pos.symbol}`)];
    });

    if (account.positions && account.positions.length > 5) {
        positionButtons.push([Markup.button.callback(`...and ${account.positions.length - 5} more`, 'view_all_positions')]);
    }

    // Compact 3-column layout
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
      ...positionButtons,
      mainRow,
      secondaryRow
    ]);

    // Update message
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      message.message_id,
      undefined,
      dashboardMessage,
      { parse_mode: 'Markdown', ...keyboard }
    );
    
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

  // Basic validation
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
