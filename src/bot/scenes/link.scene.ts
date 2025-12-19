import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { storeApiCredentials } from '../../db/users';
import { encrypt } from '../../utils/encryption';

interface LinkState {
  exchange?: 'aster' | 'hyperliquid';
  apiKey?: string;
  apiSecret?: string;
  accountAddress?: string;
  privateKey?: string;
}

export const linkScene = new Scenes.WizardScene<BotContext>(
  'link',
  
  // Step 0: Entry Point - Choose exchange
  async (ctx) => {
    await ctx.reply(
      '🔗 **Link Exchange**\n\n' +
      'Select which exchange you want to link:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Aster DEX', 'link_aster')],
          [Markup.button.callback('Hyperliquid', 'link_hyperliquid')],
          [Markup.button.callback('❌ Cancel', 'link_cancel')]
        ])
      }
    );
    return ctx.wizard.next();
  },
  
  // Step 1: Wait for API Key / Wallet Address
  async (ctx) => {
    // This step only processes TEXT input. The prompt was sent by Step 0 action.
    const state = ctx.wizard.state as LinkState;

    if (!ctx.message || !('text' in ctx.message)) return; // Ignore non-text
    const input = ctx.message.text.trim();
    
    // Save first credential
    if (state.exchange === 'aster') {
        state.apiKey = input;
    } else {
        // Validate Wallet
        if (!input.startsWith('0x') || input.length !== 42) {
            await ctx.reply('❌ Invalid address format. Must be 0x... (42 chars). Try again or cancel.');
            return; // Stay on step
        }
        state.accountAddress = input;
    }

    // PROMPT FOR NEXT STEP (Step 2)
    const prompt = state.exchange === 'aster'
      ? '🔑 **Aster API Secret**\n\nPlease enter your API Secret:'
      : '🔑 **Hyperliquid Private Key**\n\nPlease enter your Wallet Private Key (will be encrypted):';

    await ctx.reply(prompt, {
        parse_mode: 'Markdown',
         ...Markup.inlineKeyboard([
             [Markup.button.callback('« Back', 'link_back_step1')],
             [Markup.button.callback('❌ Cancel', 'link_cancel')]
         ])
    });
    
    return ctx.wizard.next();
  },

  // Step 2: Wait for Secret / Private Key
  async (ctx) => {
      const state = ctx.wizard.state as LinkState;
      
      if (!ctx.message || !('text' in ctx.message)) return;
      const input = ctx.message.text.trim();

      // Save second credential
      if (state.exchange === 'aster') {
          state.apiSecret = input;
      } else {
          // Validate Key
          let pk = input;
          if (!pk.startsWith('0x')) pk = '0x' + pk;
          if (pk.length !== 66) {
              await ctx.reply('❌ Invalid key format. Must be 64 hex characters. Try again.');
              return;
          }
          state.privateKey = pk;
      }

      // --- DB SAVE LOGIC ---
      await ctx.reply('⏳ Validating & Saving...');
      
      // Get User Logic
      let userId = ctx.session.userId;
      if (!userId) {
          if (!ctx.from) {
               await ctx.reply('❌ Error: User context missing.');
               return ctx.scene.leave();
          }
          const { getOrCreateUser } = await import('../../db/users');
          const user = await getOrCreateUser(ctx.from.id, ctx.from.username);
          ctx.session.userId = user.id;
          userId = user.id;
      }

      try {
        if (state.exchange === 'aster') {
          await storeApiCredentials(userId, 'aster', encrypt(state.apiKey!), encrypt(state.apiSecret!));
        } else {
          await storeApiCredentials(userId, 'hyperliquid', encrypt(state.accountAddress!), encrypt(state.privateKey!));
        }

        ctx.session.activeExchange = state.exchange;
        ctx.session.isLinked = true;

        await ctx.reply(
            `✅ **Linked Successfully!**\n\nEntering Citadel...`,
            { parse_mode: 'Markdown' }
        );
        return ctx.scene.enter('citadel');

      } catch (e: any) {
          console.error(e);
          await ctx.reply(`❌ Link Failed: ${e.message}`);
          return ctx.scene.leave();
      }
  }
);

// --- ACTIONS ---

linkScene.action('link_aster', async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    state.exchange = 'aster';
    await ctx.answerCbQuery();
    
    // PROMPT FOR STEP 1
    const prompt = '🔑 **Aster API Key**\n\nPlease enter your Public API Key:';
    
    await ctx.editMessageText(prompt, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'link_cancel')]
        ])
    });
    // Now move cursor to Step 1 to listen for answer
    return ctx.wizard.selectStep(1); 
});

linkScene.action('link_hyperliquid', async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    state.exchange = 'hyperliquid';
    await ctx.answerCbQuery();

    // PROMPT FOR STEP 1
    const prompt = '🔑 **Hyperliquid Wallet**\n\nPlease enter your Wallet Address (0x...):';
    
    await ctx.editMessageText(prompt, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'link_cancel')]
        ])
    });
    return ctx.wizard.selectStep(1);
});

linkScene.action('link_cancel', async (ctx) => {
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Link cancelled.');
    // Return to "Home" (Citadel Welcome)
    return ctx.scene.enter('citadel');
});

linkScene.action('link_back_step1', async (ctx) => {
    await ctx.answerCbQuery();
    const state = ctx.wizard.state as LinkState;
    
    // Go Back to Step 1 & Re-Prompt
    const prompt = state.exchange === 'aster' 
        ? '🔑 **Aster API Key**\n\nPlease enter your Public API Key:' 
        : '🔑 **Hyperliquid Wallet**\n\nPlease enter your Wallet Address (0x...):';
    
    await ctx.editMessageText(prompt, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'link_cancel')]
        ])
    });
    return ctx.wizard.selectStep(1);
});
