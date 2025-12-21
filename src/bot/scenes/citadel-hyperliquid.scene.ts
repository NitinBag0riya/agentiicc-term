import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const citadelHyperliquidScene = new Scenes.BaseScene<BotContext>('citadel_hyperliquid');

// Enter handler - Screen 17: Hyperliquid Command Citadel
citadelHyperliquidScene.enter(async (ctx) => {
  const userId = ctx.from?.id?.toString();
  
  const { createBox } = require('../utils/format');

  let perpBalance = '0.00';
  let upnl = '+$0.00 (+0.00%)';
  let marginUsed = '$0.00';
  let spotBalance = '$0.00';
  let totalBalance = '$0.00';
  let perpAvailable = '$0.00';
  let positionsLines: any[] = [];
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      const account = await UniversalApiService.getAccountSummary(uid, 'hyperliquid');
      const posData = await UniversalApiService.getPositions(uid, 'hyperliquid');
      
      if (account) {
        // @ts-ignore
        const anyAccount = account as any;
        perpBalance = `$${parseFloat(account.totalBalance).toFixed(2)}`;
        
        // Calculate uPnL
        let calcUpnl = 0;
        if (posData) {
             posData.forEach((p: any) => calcUpnl += parseFloat(p.unrealizedPnl || '0'));
        }
        
        const pnlValue = calcUpnl;
        const pnlPercent = parseFloat(account.totalBalance) ? ((pnlValue / parseFloat(account.totalBalance)) * 100).toFixed(2) : '0.00';
        upnl = `${pnlValue >= 0 ? '+' : ''}$${pnlValue.toFixed(2)} (${pnlValue >= 0 ? '+' : ''}${pnlPercent}%)`;
        
        marginUsed = `$${(anyAccount.marginUsed || 0).toFixed(2)}`;
        spotBalance = `$${(anyAccount.spotBalance || 0).toFixed(2)}`;
        totalBalance = `$${parseFloat(account.totalBalance).toFixed(2)}`;
        perpAvailable = `$${parseFloat(account.availableBalance).toFixed(2)}`;
      }
      
      if (posData && posData.length > 0) {
        // Build position lines for createBox
        const activePositions = posData.slice(0, 2);
        
        activePositions.forEach((p: any) => {
          const side = parseFloat(p.size) > 0 ? '🟢' : '🔴';
          const pnlVal = parseFloat(p.unrealizedPnl);
          const pnlSign = pnlVal >= 0 ? '+' : '';
          const margin = parseFloat(p.initialMargin || '0') || (parseFloat(p.entryPrice) * Math.abs(parseFloat(p.size))) / parseFloat(p.leverage || '1');
          const pnlPct = ((pnlVal / (margin || 1)) * 100).toFixed(2);
          
          positionsLines.push(`${p.symbol} (${p.leverage}x) ${side}`);
          positionsLines.push(`${pnlSign}${pnlPct}% (${pnlSign}$${pnlVal.toFixed(2)})`);
          positionsLines.push(`${Math.abs(parseFloat(p.size))} ${p.symbol.replace(/USDT$/, '')}`);
          positionsLines.push(`Entry $${parseFloat(p.entryPrice).toFixed(4)} | Liq $${parseFloat(p.liquidationPrice || '0').toFixed(4)}`);
          positionsLines.push(''); // Spacer
        });
        
        if (posData.length > 2) {
          positionsLines.push(`...and ${posData.length - 2} more positions`);
        }
      } else {
         positionsLines.push('No open positions');
      }
    }
  } catch (error) {
    console.error('Error fetching Hyperliquid data:', error);
  }
  
  const lines = [
    '🏰 Command Citadel',
    '',
    '📊 Perp Portfolio:',
    { left: 'Balance:', right: perpBalance },
    { left: 'uPnL:', right: upnl },
    { left: 'Margin Used:', right: marginUsed },
    '',
    '---',
    ...positionsLines,
    '---',
    '',
    '💼 Account Summary:',
    { left: 'Perp Avail:', right: perpAvailable },
    { left: 'Total Balance:', right: totalBalance },
    '',
    '💬 Click any position',
    '   to manage',
    '💬 Type symbol to search'
  ];

  const message = createBox('Hyperliquid', lines, 34);

  await ctx.reply('```\n' + message + '\n```', {
    parse_mode: 'MarkdownV2',
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

citadelHyperliquidScene.on('text', async (ctx) => {
  const symbol = ctx.message.text.toUpperCase().trim();
  ctx.session.searchSymbol = symbol;
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('search_results');
});

citadelHyperliquidScene.action('all_assets', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('all_assets');
});

citadelHyperliquidScene.action('all_perps', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('all_perps');
});

citadelHyperliquidScene.action('trade', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.activeExchange = 'hyperliquid';
  await ctx.scene.enter('search_prompt');
});

citadelHyperliquidScene.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  await ctx.scene.reenter();
});

citadelHyperliquidScene.action('settings', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('settings');
});

citadelHyperliquidScene.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('help');
});

export default citadelHyperliquidScene;
