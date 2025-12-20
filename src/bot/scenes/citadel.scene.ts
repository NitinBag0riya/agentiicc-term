/**
 * Citadel Scene (Dashboard)
 * Displays account summary, active positions, and main navigation
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { getUnlinkedKeyboard } from '../bot';

export const citadelScene = new Scenes.BaseScene<BotContext>('citadel');

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
    
    // Format Positions (if any)
    let positionsText = '';
    if (account.positions && account.positions.length > 0) {
      positionsText = '\n\n**Active Positions:**\n';
      for (const pos of account.positions) {
        const sideIcon = pos.side === 'LONG' ? '🟢' : '🔴';
        const pnl = parseFloat(pos.unrealizedPnl).toFixed(2);
        const pnlSign = parseFloat(pos.unrealizedPnl) >= 0 ? '+' : '';
        positionsText += `${sideIcon} **${pos.symbol}** ${pos.leverage}x\n` +
                         `PnL: ${pnlSign}$${pnl}\n`;
      }
    } else {
      positionsText = '\n\n_No active positions_';
    }

    const dashboardMessage = 
      `🏰 **CITADEL OVERVIEW**
      
**Exchange:** ${exchange.toUpperCase()}

💰 **Balance:** $${balance}
💵 **Available:** $${available}
${positionsText}

_Type a symbol (e.g., "BTC") to trade_`;

    // Buttons as per DFD
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📈 Trade / Search', 'search_prompt')],
      [Markup.button.callback('🔄 Refresh', 'refresh')],
      [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('❓ Help', 'help')]
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
        [Markup.button.callback('🔄 Retry', 'refresh')]
      ])
    );
  }
}

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

citadelScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('⚙️ Settings coming in Module 3');
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
  // For now, just a placeholder as trading scene isn't ready
  // Once trading.scene.ts is created, we will enter it:
  // ctx.scene.enter('trading', { symbol });
  
  await ctx.reply(`🚀 Opening trading terminal for **${symbol}**...`);
  // TODO: ctx.scene.enter('trading', { symbol });
});

citadelScene.action('cancel_search', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
});
