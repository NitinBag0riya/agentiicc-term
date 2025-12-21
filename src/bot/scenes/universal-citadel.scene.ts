import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const universalCitadelScene = new Scenes.BaseScene<BotContext>('universal_citadel');

// Enter handler - Screen 15: Universal Command Citadel
universalCitadelScene.enter(async (ctx) => {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;
  const { createBox } = require('../utils/format');
  const { getOrCreateUser } = require('../../db/users');
  
  // Fetch linked exchanges data
  let asterStatus = '❌ Not Connected';
  let hyperliquidStatus = '❌ Not Connected';
  let asterBalance = 'Click to connect';
  let hyperliquidBalance = 'Click to connect';
  let asterPnl = '';
  let hyperliquidPnl = '';
  let asterPositions = '';
  let hyperliquidPositions = '';
  
  let asterConnected = false;
  let hyperliquidConnected = false;
  
  try {
    if (telegramId) {
      // Resolve internal User ID
      const user = await getOrCreateUser(telegramId, username);
      const userId = user.id;

      // Check Aster
      try {
        const asterData = await UniversalApiService.getAccountSummary(userId, 'aster');
        if (asterData) {
          asterConnected = true;
          asterStatus = '✅ Connected';
          const balance = parseFloat(asterData.totalBalance);
          asterBalance = `Balance: $${isNaN(balance) ? '0.00' : balance.toFixed(2)}`;
          
          let totalUpnl = 0;
          if (asterData.positions) {
             for (const pos of asterData.positions) {
                const pnl = parseFloat(pos.unrealizedPnl);
                if (!isNaN(pnl)) {
                    totalUpnl += pnl;
                }
             }
          }
          asterPnl = `uPnL: ${totalUpnl >= 0 ? '+' : ''}$${totalUpnl.toFixed(2)}`;
          asterPositions = `${asterData.positions?.length || 0} Positions`;
        }
      } catch (e) {
        console.error('[Citadel] Aster connection check failed:', e);
      }
      
      // Check Hyperliquid
      try {
        console.log('[Citadel] Checking Hyperliquid connection for userId:', userId);
        const hlData = await UniversalApiService.getAccountSummary(userId, 'hyperliquid');
        if (hlData) {
          hyperliquidConnected = true;
          hyperliquidStatus = '✅ Connected';
          const balance = parseFloat(hlData.totalBalance);
          hyperliquidBalance = `Balance: $${isNaN(balance) ? '0.00' : balance.toFixed(2)}`;
          
          let totalUpnl = 0;
          if (hlData.positions) {
             for (const pos of hlData.positions) {
                const pnl = parseFloat(pos.unrealizedPnl);
                if (!isNaN(pnl)) {
                    totalUpnl += pnl;
                }
             }
          }
          hyperliquidPnl = `uPnL: ${totalUpnl >= 0 ? '+' : ''}$${totalUpnl.toFixed(2)}`;
          hyperliquidPositions = `${hlData.positions?.length || 0} Positions`;
        }
      } catch (e: any) {
        console.error('[Citadel] Hyperliquid connection check failed:', e);
        // If specific error "No credentials", we know why.
      }
    }
  } catch (error) {
    console.error('Error fetching universal data:', error);
  }
  
  // Box content preparation...
  
  const lines = [
    { left: 'Connected Exchanges:', right: '' },
    '',
    { left: asterConnected ? '✅ Aster DEX' : '❌ Aster DEX', right: '' },
    { left: hyperliquidConnected ? '✅ Hyperliquid' : '❌ Hyperliquid', right: '' },
    !asterConnected && !hyperliquidConnected ? '(No exchanges connected)' : null,
    '---',
    { left: '📊 Portfolio Overview:', right: '' },
    '',
    { left: '🔸 Aster DEX:', right: '' },
    { left: asterBalance, right: '' },
    asterPnl ? { left: asterPnl, right: '' } : null,
    asterPositions ? { left: asterPositions, right: '' } : null,
    '',
    { left: '🔸 Hyperliquid:', right: '' },
    { left: hyperliquidBalance, right: '' },
    hyperliquidPnl ? { left: hyperliquidPnl, right: '' } : null,
    hyperliquidPositions ? { left: hyperliquidPositions, right: '' } : null,
    '---',
    '💬 Click connected exchange',
    '   for full dashboard',
    '💬 Click unlinked exchange',
    '   to connect it'
  ];

  // Create box with wider width (34) to avoid title truncation
  const message = createBox('🌍 Universal Command Citadel', lines, 34);

  // Build keyboard based on connection status
  const row1 = [];
  if (asterConnected) {
    row1.push(Markup.button.callback('✅ Aster DEX', 'citadel_aster'));
  } else {
    row1.push(Markup.button.callback('❌ Connect Aster', 'connect_aster'));
  }
  if (hyperliquidConnected) {
    row1.push(Markup.button.callback('✅ Hyperliquid', 'citadel_hyperliquid'));
  } else {
    row1.push(Markup.button.callback('❌ Connect Hyperliquid', 'connect_hyperliquid'));
  }
  
  // Actually, wait, box characters might look better without code block on mobile if width is small?
  // But code block guarantees alignment.
  // Let's wrap message in backticks for code block.
  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
     ...Markup.inlineKeyboard([
      row1,
      [
        Markup.button.callback('📊 All Assets', 'all_assets'),
        Markup.button.callback('💰 Trade', 'trade'),
      ],
      [
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('❓ Help', 'help'),
      ],
    ]),
  });
});

universalCitadelScene.action('citadel_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('citadel_aster');
});

universalCitadelScene.action('citadel_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('citadel_hyperliquid');
});

universalCitadelScene.action('connect_aster', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('confirm_connect_aster');
});

universalCitadelScene.action('connect_hyperliquid', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('confirm_connect_hyperliquid');
});

universalCitadelScene.action('all_assets', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('all_assets_universal');
});

universalCitadelScene.action('trade', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('search_prompt_universal');
});

universalCitadelScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings_universal');
});

universalCitadelScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

export default universalCitadelScene;
