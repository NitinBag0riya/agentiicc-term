import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const citadelHyperliquidScene = new Scenes.BaseScene<BotContext>('citadel_hyperliquid');

// Enter handler - Screen 17: Hyperliquid Command Citadel
citadelHyperliquidScene.enter(async (ctx) => {
  const userId = ctx.from?.id?.toString();
  
  let perpBalance = '0.00';
  let upnl = '+$0.00 (+0.00%)';
  let marginUsed = '$0.00';
  let spotBalance = '$0.00';
  let totalBalance = '$0.00';
  let perpAvailable = '$0.00';
  let positions: string[] = [];
  
  try {
    if (userId) {
      const account = await UniversalApiService.getAccount(userId, 'hyperliquid');
      const posData = await UniversalApiService.getPositions(userId, 'hyperliquid');
      
      if (account) {
        perpBalance = `$${account.perpBalance?.toFixed(2) || '0.00'}`;
        const pnlValue = account.unrealizedPnl || 0;
        const pnlPercent = account.perpBalance ? ((pnlValue / account.perpBalance) * 100).toFixed(2) : '0.00';
        upnl = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlValue >= 0 ? '+' : ''}${pnlPercent}%)`;
        marginUsed = `$${account.marginUsed?.toFixed(2) || '0.00'}`;
        spotBalance = `$${account.spotBalance?.toFixed(2) || '0.00'}`;
        totalBalance = `$${account.totalBalance?.toFixed(2) || '0.00'}`;
        perpAvailable = `$${account.perpAvailable?.toFixed(2) || '0.00'}`;
      }
      
      if (posData && posData.length > 0) {
        positions = posData.slice(0, 2).map((p: any) => {
          const side = parseFloat(p.positionAmt) > 0 ? '🟢' : '🔴';
          const pnlSign = parseFloat(p.unRealizedProfit) >= 0 ? '+' : '';
          const pnlPct = ((parseFloat(p.unRealizedProfit) / parseFloat(p.margin || '1')) * 100).toFixed(2);
          return `│ ${p.symbol} (${p.leverage}x ${p.marginType === 'CROSS' ? 'Cross' : 'Isolated'}) ${side}    │
│ ${pnlSign}${pnlPct}% (${pnlSign}$${parseFloat(p.unRealizedProfit).toFixed(2)})          │
│ ${Math.abs(parseFloat(p.positionAmt))} ${p.symbol.replace(/USDT$/, '')}/$${parseFloat(p.notional).toFixed(0)}            │
│ Margin $${parseFloat(p.margin).toFixed(2)}              │
│ Entry $${parseFloat(p.entryPrice).toFixed(5)}              │
│ Mark $${parseFloat(p.markPrice).toFixed(5)}               │
│ Liq $${parseFloat(p.liquidationPrice).toFixed(5)}                │`;
        });
        
        if (posData.length > 2) {
          positions.push(`│ ...and ${posData.length - 2} more               │`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Hyperliquid data:', error);
  }
  
  const positionsText = positions.length > 0 ? positions.join('\n│                             │\n') : '│ No open positions           │';
  
  const message = `┌─────────────────────────────┐
│ 🏰 Hyperliquid Command      │
│    Citadel                  │
│                             │
│ 📊 Perp Portfolio:          │
│ balance ${perpBalance}           │
│ uPnL: ${upnl}     │
│ Margin Used: ${marginUsed}      │
│                             │
${positionsText}
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💼 Account Summary:         │
│ Perp available ${perpAvailable}    │
│                             │
│ Account Balance: ${totalBalance}  │
│                             │
│ 💬 Click any position       │
│    to manage                │
│ 💬 Type symbol to search    │
│    (e.g., BTC)              │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 All Assets', 'all_assets'),
        Markup.button.callback('📈 All Perps', 'all_perps'),
      ],
      [
        Markup.button.callback('💰 Trade', 'trade'),
        Markup.button.callback('🔄 Refresh', 'refresh'),
      ],
      [
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('❓ Help', 'help'),
      ],
    ]),
  });
});

citadelHyperliquidScene.on('text', async (ctx) => {
  const symbol = ctx.message.text.toUpperCase().trim();
  ctx.session.searchSymbol = symbol;
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('search_results');
});

citadelHyperliquidScene.action('all_assets', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('all_assets');
});

citadelHyperliquidScene.action('all_perps', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('all_perps');
});

citadelHyperliquidScene.action('trade', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('search_prompt');
});

citadelHyperliquidScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

citadelHyperliquidScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings');
});

citadelHyperliquidScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

export default citadelHyperliquidScene;
