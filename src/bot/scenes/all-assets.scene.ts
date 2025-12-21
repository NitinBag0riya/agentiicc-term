import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const allAssetsScene = new Scenes.BaseScene<BotContext>('all_assets');

// Enter handler - Screen 20: All Assets
allAssetsScene.enter(async (ctx) => {
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  const { createBox } = require('../utils/format');

  let totalBalance = '$0.00';
  let assetsLines: string[] = [];
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      const account = await UniversalApiService.getAccountSummary(uid, exchange);
      if (account) {
        // @ts-ignore
        totalBalance = `$${(account.spotBalance || account.totalBalance).toFixed(2)}`;
      }
      
      // const assets = await UniversalApiService.getAssets(uid, exchange);
      const assets: any[] = []; // TODO: Implement getAssets in UniversalApiService
      if (assets && assets.length > 0) {
        const activeAssets = assets.slice(0, 5);
        activeAssets.forEach((a: any) => {
          const pnlSign = parseFloat(a.pnlPercent || '0') >= 0 ? '+' : '';
          assetsLines.push(`${a.symbol} ${pnlSign}${a.pnlPercent || '0.00'}% (${pnlSign}$${a.pnlValue || '0.00'})`);
          assetsLines.push(`${a.amount} ${a.baseAsset}`);
          assetsLines.push('');
        });
        
        if (assets.length > 5) {
          assetsLines.push(`...and ${assets.length - 5} more`);
        }
      } else {
        assetsLines.push('No assets found');
      }
    }
  } catch (error) {
    console.error('Error fetching assets:', error);
  }
  
  const lines = [
    '📊 All Assets',
    '',
    'Spot Portfolio:',
    `Balance: ${totalBalance}`,
    '',
    ...assetsLines,
    '---',
    '',
    '💬 Click any asset to',
    '   manage'
  ];

  const message = createBox('Assets', lines, 34);

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
