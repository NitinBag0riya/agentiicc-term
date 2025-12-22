import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const leverageMenuScene = new Scenes.BaseScene<BotContext>('leverage_menu');

// Enter handler - Screen 35: Leverage Menu
leverageMenuScene.enter(async (ctx) => {
  // Sync current leverage from exchange
  let currentLeverage = ctx.session.leverage || 10;
  
  try {
    const exchange = ctx.session.activeExchange || 'aster';
    const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
    const userId = ctx.from?.id?.toString();
    
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const leverageInfo = await UniversalApiService.getLeverage(user.id, exchange, symbol);
      if (leverageInfo && leverageInfo.leverage) {
        currentLeverage = leverageInfo.leverage;
        ctx.session.leverage = currentLeverage;
      }
    }
  } catch (error) {
    console.error('Error syncing leverage:', error);
  }
  
  try {
    const exchange = ctx.session.activeExchange || 'aster';
    const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
    const userId = ctx.from?.id?.toString();
    
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const leverageInfo = await UniversalApiService.getLeverage(user.id, exchange, symbol);
      if (leverageInfo && leverageInfo.leverage) {
        currentLeverage = leverageInfo.leverage;
        ctx.session.leverage = currentLeverage;
      }
    }
  } catch (error) {
    console.error('Error syncing leverage:', error);
  }
  
  const { createBox } = require('../utils/format');

  const lines = [
    '📊 Set Leverage',
    '',
    `Current: ${currentLeverage}x`,
    '',
    '---',
    '',
    'Select leverage:',
    '',
    '⚠️  Higher leverage =',
    '    higher risk'
  ];

  const message = createBox('Leverage', lines, 32);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('1x', 'lev_1'),
        Markup.button.callback('2x', 'lev_2'),
        Markup.button.callback('5x', 'lev_5'),
      ],
      [
        Markup.button.callback('10x', 'lev_10'),
        Markup.button.callback('20x', 'lev_20'),
        Markup.button.callback('25x', 'lev_25'),
      ],
      [
        Markup.button.callback('50x', 'lev_50'),
        Markup.button.callback('75x', 'lev_75'),
        Markup.button.callback('100x', 'lev_100'),
      ],
      [
        Markup.button.callback('🔙 Back', 'back'),
      ],
    ]),
  });
});

leverageMenuScene.action(/lev_(\d+)/, async (ctx) => {
  const newLeverage = parseInt(ctx.match[1]);
  await ctx.answerCbQuery(`Setting leverage to ${newLeverage}x...`);
  
  try {
    const exchange = ctx.session.activeExchange || 'aster';
    const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
    const userId = ctx.from?.id?.toString();
    
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      
      // Set on exchange
      const result = await UniversalApiService.setLeverage(user.id, exchange, symbol, newLeverage);
      
      if (result.success) {
        // Trust the setLeverage response - verification via getLeverage is unreliable
        // when there's no open position (returns default 1x, not the configured leverage)
        ctx.session.leverage = newLeverage;
        await ctx.reply(`✅ Leverage set to ${newLeverage}x`);
      } else {
        await ctx.reply(`❌ Failed to set leverage: ${result.message}`);
      }
    }
  } catch (error: any) {
    console.error('Error setting leverage:', error);
    await ctx.reply(`❌ Error setting leverage: ${error.message}`);
  }
  
  await ctx.scene.enter('position_no_open');
});

leverageMenuScene.action('back', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('position_no_open');
});

export default leverageMenuScene;
