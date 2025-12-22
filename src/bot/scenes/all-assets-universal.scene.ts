import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const allAssetsUniversalScene = new Scenes.BaseScene<BotContext>('all_assets_universal');

// Screen 51: Universal All Assets
allAssetsUniversalScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  let asterTotal = '$0.00';
  let hyperliquidTotal = '$0.00';
  let combinedTotal = '$0.00';

  try {
    const userId = ctx.from?.id?.toString();
    if (userId) {
       const { getOrCreateUser } = require('../../db/users');
       // @ts-ignore
       const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);

       // Parallel fetch
       const [asterAcct, hlAcct] = await Promise.all([
          UniversalApiService.getAccountSummary(user.id, 'aster').catch(e => null),
          UniversalApiService.getAccountSummary(user.id, 'hyperliquid').catch(e => null)
       ]);

       let asterVal = 0;
       let hlVal = 0;

       if (asterAcct) {
          // @ts-ignore
          asterVal = parseFloat(asterAcct.totalBalance || '0');
          asterTotal = `$${asterVal.toFixed(2)}`;
       }

       if (hlAcct) {
          // @ts-ignore
          hlVal = parseFloat(hlAcct.totalBalance || '0');
          hyperliquidTotal = `$${hlVal.toFixed(2)}`;
       }

       combinedTotal = `$${(asterVal + hlVal).toFixed(2)}`;
    }
  } catch (error) {
     console.error('Error fetching universal assets:', error);
  }

  const lines = [
    '📊 Universal Assets',
    '',
    'All assets across exchanges',
    '',
    '---',
    '🔸 Aster DEX',
    `Total: ${asterTotal}`,
    '',
    '🔸 Hyperliquid',
    `Total: ${hyperliquidTotal}`,
    '',
    '---',
    `Combined: ${combinedTotal}`,
    '',
    '💡 Click exchange to view',
    '   detailed assets'
  ];

  const message = createBox('Assets', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Aster Assets', 'aster_assets'),
        Markup.button.callback('📊 Hyperliquid Assets', 'hyperliquid_assets'),
      ],
      [
        Markup.button.callback('🔄 Refresh', 'refresh'),
        Markup.button.callback('🏰 Back', 'back'),
      ],
    ]),
  });
});

allAssetsUniversalScene.action('aster_assets', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'aster';
  await ctx.scene.enter('all_assets');
});

allAssetsUniversalScene.action('hyperliquid_assets', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('all_assets');
});

allAssetsUniversalScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

allAssetsUniversalScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('universal_citadel');
});

export default allAssetsUniversalScene;
