import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../../services/universal-api.service';

export const citadelAsterScene = new Scenes.BaseScene<BotContext>('citadel_aster');

// Enter handler - Screen 16: Aster Command Citadel
citadelAsterScene.enter(async (ctx) => {
  const userId = ctx.from?.id?.toString();
  
  let perpBalance = '0.00';
  let upnl = '+$0.00 (+0.00%)';
  let marginUsed = '$0.00';
  let spotBalance = '$0.00';
  let totalBalance = '$0.00';
  let perpAvailable = '$0.00';
  let spotAvailable = '$0.00';
  let positions: string[] = [];
  let spotAssets: string[] = [];
  
  try {
    if (userId) {
      const account = await UniversalApiService.getAccount(userId, 'aster');
      const posData = await UniversalApiService.getPositions(userId, 'aster');
      
      if (account) {
        perpBalance = `$${account.perpBalance?.toFixed(2) || '0.00'}`;
        const pnlValue = account.unrealizedPnl || 0;
        const pnlPercent = account.perpBalance ? ((pnlValue / account.perpBalance) * 100).toFixed(2) : '0.00';
        upnl = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlValue >= 0 ? '+' : ''}${pnlPercent}%)`;
        marginUsed = `$${account.marginUsed?.toFixed(2) || '0.00'}`;
        spotBalance = `$${account.spotBalance?.toFixed(2) || '0.00'}`;
        totalBalance = `$${account.totalBalance?.toFixed(2) || '0.00'}`;
        perpAvailable = `$${account.perpAvailable?.toFixed(2) || '0.00'}`;
        spotAvailable = `$${account.spotAvailable?.toFixed(2) || '0.00'} USDT`;
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
    console.error('Error fetching Aster data:', error);
  }
  
  const positionsText = positions.length > 0 ? positions.join('\n│                             │\n') : '│ No open positions           │';
  
  const message = `┌─────────────────────────────┐
│ 🏰 Command Citadel          │
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
│ 💼 Spot Portfolio:          │
│ Balance: ${spotBalance}          │
│                             │
│ Spot available ${spotAvailable} │
│ Perp available ${perpAvailable}    │
│                             │
│ Account Balance: ${totalBalance}  │
│                             │
│ 💬 Click any position/asset │
│    to manage                │
│ 💬 Type symbol to search    │
│    (e.g., SOL)              │
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

// Handle text input for symbol search
citadelAsterScene.on('text', async (ctx) => {
  const symbol = ctx.message.text.toUpperCase().trim();
  ctx.session.searchSymbol = symbol;
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('search_results');
});

citadelAsterScene.action('all_assets', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('all_assets');
});

citadelAsterScene.action('all_perps', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('all_perps');
});

citadelAsterScene.action('trade', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('search_prompt');
});

citadelAsterScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

citadelAsterScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings');
});

citadelAsterScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

export default citadelAsterScene;
