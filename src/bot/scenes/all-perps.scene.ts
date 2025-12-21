import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const allPerpsScene = new Scenes.BaseScene<BotContext>('all_perps');

// Enter handler - Screen 21: All Perps
allPerpsScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  let totalPositions = 0;
  let totalPnl = '+$0.00';
  let positionsList: string[] = [];
  
  try {
    if (userId) {
      const positions = await UniversalApiService.getPositions(userId, exchange);
      if (positions && positions.length > 0) {
        totalPositions = positions.length;
        
        let combinedPnl = 0;
        positions.forEach((p: any) => {
          combinedPnl += parseFloat(p.unRealizedProfit || '0');
        });
        totalPnl = `${combinedPnl >= 0 ? '+' : ''}$${combinedPnl.toFixed(2)}`;
        
        positionsList = positions.slice(0, 3).map((p: any) => {
          const side = parseFloat(p.positionAmt) > 0 ? '🟢' : '🔴';
          const pnlSign = parseFloat(p.unRealizedProfit) >= 0 ? '+' : '';
          const pnlPct = ((parseFloat(p.unRealizedProfit) / parseFloat(p.margin || '1')) * 100).toFixed(2);
          return `│ ${p.symbol} (${p.leverage}x ${p.marginType === 'CROSS' ? 'Cross' : 'Isolated'}) ${side}    │
│ ${pnlSign}${pnlPct}% (${pnlSign}$${parseFloat(p.unRealizedProfit).toFixed(2)})          │
│ ${Math.abs(parseFloat(p.positionAmt))} ${p.symbol.replace(/USDT$/, '')}/$${parseFloat(p.notional).toFixed(0)}            │`;
        });
        
        if (positions.length > 3) {
          positionsList.push(`│ ...and ${positions.length - 3} more               │`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching positions:', error);
  }
  
  const positionsText = positionsList.length > 0 ? positionsList.join('\n│                             │\n') : '│ No open positions           │';
  
  const message = `┌─────────────────────────────┐
│ 📈 All Perpetual Positions  │
│                             │
│ Total: ${totalPositions} positions          │
│ Combined uPnL: ${totalPnl}     │
│                             │
${positionsText}
│                             │
│ 💬 Click any position to    │
│    manage                   │
└─────────────────────────────┘`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Refresh', 'refresh'),
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

allPerpsScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

allPerpsScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default allPerpsScene;
