import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';

export const allAssetsUniversalScene = new Scenes.BaseScene<BotContext>('all_assets_universal');

// Screen 51: Universal All Assets
allAssetsUniversalScene.enter(async (ctx) => {
  const { createBox } = require('../utils/format');

  // Placeholder values - in a real implementation these should be fetched dynamically
  const asterTotal = '$5,234.50';
  const hyperliquidTotal = '$3,456.72';
  const combinedTotal = '$8,691.22';

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
