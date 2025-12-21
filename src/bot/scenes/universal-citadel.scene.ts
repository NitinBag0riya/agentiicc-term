import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const universalCitadelScene = new Scenes.BaseScene<BotContext>('universal_citadel');

// Enter handler - Screen 15: Universal Command Citadel
universalCitadelScene.enter(async (ctx) => {
  const userId = ctx.from?.id?.toString();
  
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
    if (userId) {
      // Check Aster
      try {
        const asterData = await UniversalApiService.getAccount(userId, 'aster');
        if (asterData) {
          asterConnected = true;
          asterStatus = '✅ Connected';
          asterBalance = `Balance: $${asterData.totalBalance?.toFixed(2) || '0.00'}`;
          asterPnl = `uPnL: ${asterData.unrealizedPnl >= 0 ? '+' : ''}$${asterData.unrealizedPnl?.toFixed(2) || '0.00'}`;
          asterPositions = `${asterData.positions?.length || 0} Positions`;
        }
      } catch (e) {}
      
      // Check Hyperliquid
      try {
        const hlData = await UniversalApiService.getAccount(userId, 'hyperliquid');
        if (hlData) {
          hyperliquidConnected = true;
          hyperliquidStatus = '✅ Connected';
          hyperliquidBalance = `Balance: $${hlData.totalBalance?.toFixed(2) || '0.00'}`;
          hyperliquidPnl = `uPnL: ${hlData.unrealizedPnl >= 0 ? '+' : ''}$${hlData.unrealizedPnl?.toFixed(2) || '0.00'}`;
          hyperliquidPositions = `${hlData.positions?.length || 0} Positions`;
        }
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error fetching universal data:', error);
  }
  
  const message = `┌─────────────────────────────┐
│ 🌍 Universal Command Citadel │
│                             │
│ Connected Exchanges:        │
│                             │
│ ${asterConnected ? '✅' : '❌'} Aster DEX                │
│ ${hyperliquidConnected ? '✅' : '❌'} Hyperliquid              │
${!asterConnected && !hyperliquidConnected ? '│   (No exchanges connected)  │\n' : ''}│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 📊 Portfolio Overview:      │
│                             │
│ 🔸 Aster DEX:               │
│ ${asterBalance}          │
${asterPnl ? `│ ${asterPnl}     │\n` : ''}${asterPositions ? `│ ${asterPositions}                 │\n` : ''}│                             │
│ 🔸 Hyperliquid:             │
│ ${hyperliquidBalance}          │
${hyperliquidPnl ? `│ ${hyperliquidPnl}     │\n` : ''}${hyperliquidPositions ? `│ ${hyperliquidPositions}                 │\n` : ''}│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💬 Click connected exchange │
│    for full dashboard       │
│ 💬 Click unlinked exchange  │
│    to connect it            │
└─────────────────────────────┘`;

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
  
  await ctx.reply(message, {
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
