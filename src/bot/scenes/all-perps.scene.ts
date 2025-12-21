import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const allPerpsScene = new Scenes.BaseScene<BotContext>('all_perps');

// Enter handler - Screen 21: All Perps
allPerpsScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  const { createBox } = require('../utils/format');

  let totalPositions = 0;
  let totalPnl = '+$0.00';
  let positionsLines: string[] = [];
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      const positions = await UniversalApiService.getPositions(uid, exchange);
      if (positions && positions.length > 0) {
        totalPositions = positions.length;
        
        let combinedPnl = 0;
        positions.forEach((p: any) => {
          combinedPnl += parseFloat(p.unRealizedProfit || p.unrealizedPnl || '0');
        });
        totalPnl = `${combinedPnl >= 0 ? '+' : ''}$${combinedPnl.toFixed(2)}`;
        
        const activePositions = positions.slice(0, 3);
        activePositions.forEach((p: any) => {
           const qty = parseFloat(p.size || p.positionAmt);
           const side = qty > 0 ? '🟢' : '🔴';
           const pnlVal = parseFloat(p.unRealizedProfit || p.unrealizedPnl);
           const pnlSign = pnlVal >= 0 ? '+' : '';
           const notional = Math.abs(qty) * parseFloat(p.markPrice || '1');
           // fallback logic
           const margin = parseFloat(p.margin) || (notional / parseFloat(p.leverage || '1'));
           const pnlPct = ((pnlVal / (margin || 1)) * 100).toFixed(2);
           
           positionsLines.push(`${p.symbol} (${p.leverage}x) ${side}`);
           positionsLines.push(`${pnlSign}${pnlPct}% (${pnlSign}$${pnlVal.toFixed(2)})`);
           positionsLines.push(`${Math.abs(qty)} ${p.symbol.replace(/USDT$/, '')} / $${notional.toFixed(0)}`);
           positionsLines.push('');
        });
        
        if (positions.length > 3) {
          positionsLines.push(`...and ${positions.length - 3} more positions`);
        }
      } else {
         positionsLines.push('No open positions');
      }
    }
  } catch (error) {
    console.error('Error fetching positions:', error);
  }

  const lines = [
    '📈 All Perpetual Positions',
    '',
    `Total: ${totalPositions} positions`,
    `Combined uPnL: ${totalPnl}`,
    '',
    ...positionsLines,
    '---',
    '',
    '💬 Click any position to',
    '   manage'
  ];

  const message = createBox('Perps', lines, 34);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
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
