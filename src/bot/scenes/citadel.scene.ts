import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { AdapterFactory } from '../../adapters/factory';
import { formatters } from '../utils/formatters';

export const citadelScene = new Scenes.WizardScene<BotContext>(
  'citadel',
  
  // Step 1: Dashboard Render
  async (ctx) => {
    console.log('🏰 DATA TRACE: Citadel Step 1 Entered. Session:', JSON.stringify(ctx.session));
    const userId = ctx.session.userId;
    const exchangeId = ctx.session.activeExchange;

    // 1. UNLINKED STATE (Welcome Dashboard)
    if (!userId || !exchangeId) {
         await ctx.reply(
             '👋 **Welcome to AgentiFi**\n\n' +
             'Your non-custodial trading terminal.\n' +
             'Connect an exchange to start trading.',
             {
                 parse_mode: 'Markdown',
                 ...Markup.inlineKeyboard([
                     [Markup.button.callback('🔗 Link Exchange', 'enter_link_wizard')],
                     [Markup.button.callback('❓ Help', 'help')]
                 ])
             }
         );
         return ctx.wizard.next();
    }

    // 2. LINKED STATE (Normal Citadel)
    try {
        const loadingMsg = await ctx.reply('🏰 Entering Citadel...');
        
        // Fetch Account Data
        const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
        const account = await adapter.getAccount();
        
        // Format Message
        const exchangeName = exchangeId === 'aster' ? 'Aster DEX 🌟' : 'Hyperliquid ⚡';
        const totalBal = parseFloat(account.totalBalance || '0');
        const availBal = parseFloat(account.availableBalance || '0');
        
        let message = `🏰 **Citadel Overview**\n\n`;
        message += `Exchange: **${exchangeName}**\n`;
        message += `💰 Total Balance: **$${(isNaN(totalBal) ? 0 : totalBal).toFixed(2)}**\n`;
        message += `💵 Available: **$${(isNaN(availBal) ? 0 : availBal).toFixed(2)}**\n\n`;

        if (account.positions && account.positions.length > 0) {
             message += `📊 **Open Positions** (${account.positions.length})\n`;
             // Show top 3 positions summary
             account.positions.slice(0, 3).forEach(pos => {
                 const pnl = parseFloat(pos.unrealizedPnl || '0');
                 const pnlIcon = pnl >= 0 ? '🟢' : '🔴';
                 const pnlStr = formatters.pnlValue(pos.unrealizedPnl);
                 message += `• ${pos.symbol} ${pos.side}: ${pnlIcon} ${pnlStr}\n`;
             });
             if (account.positions.length > 3) message += `... and ${account.positions.length - 3} more\n`;
        } else {
            message += `🧘 No open positions.\n`;
        }
        
        message += `\n_Select an action or Type a Symbol (e.g. BTC) to trade:_`;

        // Cleanup loading message
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('📈 All Perps', 'all_perps'),
                    Markup.button.callback('💰 All Assets', 'all_assets')
                ],
                [
                    Markup.button.callback('⚔️ Trade', 'search_prompt'),
                    Markup.button.callback('⚙️ Settings', 'enter_settings')
                ],
                [
                    Markup.button.callback('❓ Help', 'help'),
                    Markup.button.callback('🔄 Refresh', 'refresh_citadel')
                ]
            ])
        });
        
        return ctx.wizard.next();

    } catch (error: any) {
        console.error('Citadel Error:', error);
        await ctx.reply(`❌ Error loading Citadel: ${error.message}`);
        await ctx.reply('Try linking again if issues persist.', {
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Relink Exchange', 'enter_link_wizard')]
            ])
        });
        return ctx.wizard.next();
    }
  },

  // Step 2: Global Search Listener & Command Handler
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text.trim().toUpperCase();
        
        // Navigation Commands (Redundant checking here, but safe)
        if (text === '/START' || text === '/MENU') {
            return ctx.scene.enter('citadel');
        }
        if (text === '/HELP') return; // Handled by scene.command

        // Search (Asset)
        // Regex: 2-10 chars, alphanumeric. Ignore purely logic commands if any.
        if (/^[A-Z0-9]{2,10}$/.test(text)) {
            return ctx.scene.enter('trading', { symbol: text });
        }
        
        // If unknown input, just hint
        await ctx.reply('🔍 **Search**: Type a symbol (e.g. BTC) to trade.\nOr use the buttons below.');
    }
    return;
  }
);

// --- GLOBAL COMMAND INTERCEPTORS ---
citadelScene.command('start', async (ctx) => {
    await ctx.scene.leave();
    return ctx.scene.enter('citadel');
});
citadelScene.command('menu', async (ctx) => {
    await ctx.scene.leave();
    return ctx.scene.enter('citadel');
});

// --- ACTION HANDLERS ---

citadelScene.action('refresh_citadel', async (ctx) => {
    await ctx.answerCbQuery('Refreshing...');
    return ctx.scene.reenter();
});

citadelScene.action('back_to_dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.reenter(); // Go back to start
});

citadelScene.action('enter_settings', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('settings');
});

citadelScene.action('search_prompt', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('trading'); 
});

citadelScene.action('enter_link_wizard', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('link'); 
});

// --- REAL IMPLEMENTATIONS ---

citadelScene.action('all_perps', async (ctx) => {
    try {
        await ctx.answerCbQuery('Fetching positions...');
        
        const userId = ctx.session.userId!;
        const exchangeId = ctx.session.activeExchange!;
        const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
        
        const positions = await adapter.getPositions(); // Universal API Call
        
        if (positions.length === 0) {
            await ctx.reply('🧘 **No Open Positions**', {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'back_to_dashboard')]])
            });
            return;
        }

        let msg = `📊 **All Positions (${positions.length})**\n\n`;
        
        for (const p of positions) {
            const size = parseFloat(p.size);
            const side = size > 0 ? '🟢 LONG' : '🔴 SHORT';
            const sizeStr = Math.abs(size).toFixed(4);
            const pnl = parseFloat(p.unrealizedPnl);
            const pnlSign = pnl >= 0 ? '+' : '';
            
            msg += `**${p.symbol}** ${side}\n`;
            msg += `Size: ${sizeStr} | Entry: ${parseFloat(p.entryPrice).toFixed(4)}\n`;
            msg += `PnL: ${pnlSign}$${pnl.toFixed(2)}\n`;
            msg += `──────────────\n`;
        }
        
        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Refresh', 'all_perps')],
                [Markup.button.callback('« Back', 'back_to_dashboard')]
            ])
        });
        
    } catch (error: any) {
        await ctx.reply(`❌ Error fetching positions: ${error.message}`);
    }
});

citadelScene.action('all_assets', async (ctx) => {
    try {
        await ctx.answerCbQuery('Fetching assets...');
        // Just show summary or top assets for now
        // A full list might be too long for Telegram message limits (pagination needed)
        
        const adapter = AdapterFactory.createPublicAdapter(ctx.session.activeExchange || 'aster');
        const assets = await adapter.getAssets();
        
        // Show top 20 or summary
        let msg = `💰 **Available Assets (${assets.length})**\n\n`;
        msg += `Exchange: ${ctx.session.activeExchange}\n\n`;
        
        // List first 15
        const subset = assets.slice(0, 15);
        subset.forEach(a => {
            msg += `• **${a.symbol}** (${a.baseAsset})\n`;
        });
        
        if (assets.length > 15) msg += `\n...and ${assets.length - 15} more.`;
        
        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('« Back', 'back_to_dashboard')]
            ])
        });

    } catch (error: any) {
        await ctx.reply(`❌ Error fetching assets: ${error.message}`);
    }
});

citadelScene.action('help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📘 **Help**\n\n' +
        '• **Citadel**: Your main dashboard.\n' +
        '• **Trade**: open new positions.\n' +
        '• **All Perps**: View detailed position list.\n' +
        '• **Settings**: Manage exchange connections.\n' +
        '• **Search**: Just type a symbol (e.g. ETH) to trade it.\n',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'back_to_dashboard')]]) }
    );
});
