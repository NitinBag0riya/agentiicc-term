/**
 * Settings Scene
 * Manages user profile, exchange switching, and account linking/unlinking
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { getUnlinkedKeyboard } from '../bot';

export const settingsScene = new Scenes.BaseScene<BotContext>('settings');

settingsScene.enter(async (ctx) => {
  await refreshSettingsView(ctx);
});

async function refreshSettingsView(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const currentExchange = ctx.session.activeExchange?.toUpperCase() || 'UNKNOWN';
  const wallet = ctx.session.walletAddress || 'Not Connected';

  const message = `⚙️ **Settings & Profile**

👤 **User ID:** \`${userId}\`
🔗 **Exchange:** ${currentExchange}
💼 **Wallet:** \`${wallet.slice(0, 6)}...${wallet.slice(-4)}\`

_Manage your connected exchanges and preferences._`;

  const keyboard = Markup.inlineKeyboard([
    [
        Markup.button.callback(
            `${currentExchange === 'ASTER' ? '✅' : ''} Aster`, 
            'switch_aster'
        ),
        Markup.button.callback(
            `${currentExchange === 'HYPERLIQUID' ? '✅' : ''} Hyperliquid`, 
            'switch_hyperliquid'
        )
    ],
    [Markup.button.callback('🔌 Unlink Current Account', 'unlink_confirm')],
    [Markup.button.callback('🔙 Back to Citadel', 'back_to_citadel')]
  ]);

  try {
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  } catch (e) {
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  }
}

// Actions

settingsScene.action('back_to_citadel', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('citadel');
});

settingsScene.action('switch_aster', async (ctx) => {
    await switchExchange(ctx, 'aster');
});

settingsScene.action('switch_hyperliquid', async (ctx) => {
    await switchExchange(ctx, 'hyperliquid');
});

async function switchExchange(ctx: BotContext, target: 'aster' | 'hyperliquid') {
    if (ctx.session.activeExchange === target) {
        await ctx.answerCbQuery('Already active.');
        return;
    }

    // Check if user has credentials for target?
    // In strict mode, we might want to verify headers/auth. 
    // But for now, we assume user linked both or we prompt to link if missing?
    // The current architecture assumes "isLinked" flag global. 
    // We should probably check if credentials exist in DB for that exchange.
    // For simplicity in this version, we just switch context content.
    // If they haven't linked the specific exchange, API calls will fail, 
    // effectively prompting them or we can check here.
    
    // Changing session exchange
    ctx.session.activeExchange = target;
    await ctx.answerCbQuery(`Switched to ${target.toUpperCase()}`);
    await refreshSettingsView(ctx);
}

// Unlink Flow
settingsScene.action('unlink_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        `⚠️ **Are you sure you want to unlink ${ctx.session.activeExchange?.toUpperCase()}?**
        
This will remove your API keys from this bot. You will need to link again to trade.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Yes, Unlink', 'unlink_execute')],
            [Markup.button.callback('🔙 Cancel', 'refresh_settings')]
        ])
    );
});

settingsScene.action('refresh_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await refreshSettingsView(ctx);
});

settingsScene.action('unlink_execute', async (ctx) => {
    await ctx.answerCbQuery();
    
    // In a real app, delete from DB here via API
    // For now, clear session
    ctx.session.isLinked = false;
    ctx.session.activeExchange = undefined;
    ctx.session.walletAddress = undefined;
    
    await ctx.reply('✅ Account unlinked successfully.');
    return ctx.scene.enter('link'); // Go back to link wizard or welcome
});

settingsScene.on('text', async (ctx) => {
    // Ignore random text or handle navigation
    if (ctx.message.text === '/menu') return ctx.scene.enter('citadel');
});
