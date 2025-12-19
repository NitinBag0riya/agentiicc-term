import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { AdapterFactory } from '../../adapters/factory';

interface SettingsState {
    targetSymbol?: string;
}

export const settingsScene = new Scenes.WizardScene<BotContext>(
  'settings',

  // Step 0: Main Menu
  async (ctx) => {
    // Basic entry or re-render
    if (ctx.wizard.state && (ctx.wizard.state as any).isBack) {
        return renderSettingsMenu(ctx);
    }
    
    // Initial Entry
    return renderSettingsMenu(ctx);
  },

  // Step 1: Wait for Symbol Input (for Margin Mode)
  async (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      const text = ctx.message.text.trim().toUpperCase();
      
      // Navigation Override
      if (text === '/START' || text === '/MENU') {
          return ctx.scene.enter('citadel');
      }

      // Check if it's a valid symbol format (basic check)
      if (text.startsWith('/')) return; // Ignore other commands

      const state = ctx.wizard.state as SettingsState;
      state.targetSymbol = text;

      try {
           const userId = ctx.session.userId!;
           const exchangeId = ctx.session.activeExchange!;
           const adapter = await AdapterFactory.createAdapter(userId, exchangeId);
           
           await ctx.reply(
               `🔧 **Configuring ${text}**\n\n` +
               `Select Margin Mode:`,
               {
                   parse_mode: 'Markdown',
                   ...Markup.inlineKeyboard([
                       [Markup.button.callback('🔀 Cross', 'set_cross')],
                       [Markup.button.callback('🔒 Isolated', 'set_isolated')],
                       [Markup.button.callback('« Cancel', 'back_to_settings')]
                   ])
               }
           );
           
           return ctx.wizard.next();

      } catch (e: any) {
          await ctx.reply(`❌ Error: ${e.message}`);
          return renderSettingsMenu(ctx);
      }
  },

  // Step 2: Handle Toggle Actions (Passive)
  async (ctx) => {
      // Actions handled below
      return;
  }
);

// --- GLOBAL NAVIGATION ---
settingsScene.command('start', (ctx) => ctx.scene.enter('citadel'));
settingsScene.command('menu', (ctx) => ctx.scene.enter('citadel'));

// --- RENDERER ---
async function renderSettingsMenu(ctx: BotContext) {
    const exchangeId = ctx.session.activeExchange || 'None';
    
    await ctx.reply(
        '⚙️ **Settings**\n\n' +
        `Current Exchange: **${exchangeId}**\n` +
        'Manage your preferences and connections.',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🏦 Set Margin Mode (Cross/Iso)', 'ask_asset_mode')],
                [Markup.button.callback('🔗 Link / Switch Exchange', 'link_exchange')],
                [Markup.button.callback('🔓 Unlink Exchange', 'confirm_unlink')],
                [Markup.button.callback('« Back to Citadel', 'back_to_citadel')]
            ])
        }
    );
    // Reset to Step 0 listener (though mostly action drive)
    return ctx.wizard.selectStep(0);
}

// --- ACTIONS ---

// 1. Navigation
settingsScene.action('back_to_citadel', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('citadel');
});

settingsScene.action('link_exchange', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('link');
});

settingsScene.action('confirm_unlink', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.scene.enter('unlink');
});

settingsScene.action('back_to_settings', async (ctx) => {
    await ctx.answerCbQuery();
    return renderSettingsMenu(ctx);
});

// 2. Margin Mode Logic
settingsScene.action('ask_asset_mode', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📝 **Enter Symbol**\n\n' +
        'Which asset do you want to configure? (e.g. BTC, ETH)',
        { parse_mode: 'Markdown' }
    );
    return ctx.wizard.selectStep(1); // Go to listener
});

const setMode = async (ctx: BotContext, mode: 'CROSS' | 'ISOLATED') => {
    const state = ctx.wizard.state as SettingsState;
    if (!state.targetSymbol) return;

    try {
        const userId = ctx.session.userId!;
        const exchangeId = ctx.session.activeExchange!;
        const adapter = await AdapterFactory.createAdapter(userId, exchangeId);

        if (!adapter.setMarginMode) {
            await ctx.answerCbQuery('Not supported by this exchange');
            return;
        }

        const result = await adapter.setMarginMode(state.targetSymbol, mode);
        
        if (result.success) {
            await ctx.reply(`✅ ${state.targetSymbol} set to **${mode}**`);
        } else {
            await ctx.reply(`⚠️ Failed: ${result.message}`);
        }
        
        // Return to menu
        return renderSettingsMenu(ctx);

    } catch (e: any) {
        await ctx.reply(`❌ Error: ${e.message}`);
        return renderSettingsMenu(ctx);
    }
};

settingsScene.action('set_cross', (ctx) => setMode(ctx, 'CROSS'));
settingsScene.action('set_isolated', (ctx) => setMode(ctx, 'ISOLATED'));
