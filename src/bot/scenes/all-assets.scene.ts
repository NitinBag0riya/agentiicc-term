import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const allAssetsScene = new Scenes.BaseScene<BotContext>('all_assets');

// Enter handler - Screen 20: All Assets
allAssetsScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  let totalBalance = '$0.00';
  let assetsList: string[] = [];
  
  try {
    if (userId) {
      const account = await UniversalApiService.getAccount(userId, exchange);
      if (account) {
        totalBalance = `$${account.spotBalance?.toFixed(2) || '0.00'}`;
      }
      
      const assets = await UniversalApiService.getAssets(userId, exchange);
      if (assets && assets.length > 0) {
        assetsList = assets.slice(0, 5).map((a: any) => {
          const pnlSign = parseFloat(a.pnlPercent || '0') >= 0 ? '+' : '';
          return `│ ${a.symbol} ${pnlSign}${a.pnlPercent || '0.00'}% (${pnlSign}$${a.pnlValue || '0.00'}) │
│ ${a.amount} ${a.baseAsset}              │`;
        });
        
        if (assets.length > 5) {
          assetsList.push(`│ ...and ${assets.length - 5} more               │`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching assets:', error);
  }
  
  const assetsText = assetsList.length > 0 ? assetsList.join('\n│                             │\n') : '│ No assets found             │';
  
  const message = `┌─────────────────────────────┐
│ 📊 All Assets               │
│                             │
│ Spot Portfolio:             │
│ Balance: ${totalBalance}          │
│                             │
${assetsText}
│                             │
│ 💬 Click any asset to       │
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

allAssetsScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

allAssetsScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  const exchange = ctx.session.activeExchange || 'aster';
  await ctx.scene.enter(exchange === 'hyperliquid' ? 'citadel_hyperliquid' : 'citadel_aster');
});

export default allAssetsScene;
