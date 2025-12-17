import { Scenes, Markup } from 'telegraf';
import { ApiClient } from '../../services/apiClient';

interface LinkState {
  exchange?: 'aster' | 'hyperliquid';
  credential1?: string; // API Key or Address
  credential2?: string; // Secret or Private Key
}

export const linkScene = new Scenes.WizardScene<any>(
  'link',

  // Step 1: Choose Exchange
  async (ctx) => {
    // Clear state
    ctx.wizard.state = {};

    await ctx.reply(
      '🔗 **Link Exchange**\n\n' +
      'Select which exchange you want to link:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Aster DEX', 'link_aster')],
          [Markup.button.callback('Hyperliquid', 'link_hyperliquid')],
          [Markup.button.callback('❌ Cancel', 'cancel')]
        ])
      }
    );
    return ctx.wizard.next();
  },

  // Step 2: Ask for Credential 1 (API Key or Address)
  async (ctx) => {
    const state = ctx.wizard.state as LinkState;

    if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
      const action = ctx.callbackQuery.data;
      if (action === 'cancel') {
        await ctx.editMessageText('❌ Link cancelled.');
        return ctx.scene.leave();
      }
      if (action === 'link_aster') state.exchange = 'aster';
      else if (action === 'link_hyperliquid') state.exchange = 'hyperliquid';

      await ctx.answerCbQuery();
    }

    if (!state.exchange) {
      await ctx.reply('Please select an exchange.');
      return; // Stay
    }

    if (state.exchange === 'aster') {
      await ctx.reply(
        '🔑 **Link Aster DEX**\n\n' +
        '**Step 1 of 2:** Send your **API Key**\n\n' +
        '📝 _You can create this in Aster Account → API Management_',
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        '🔑 **Link Hyperliquid**\n\n' +
        '**Step 1 of 2:** Send your **Wallet Address**',
        { parse_mode: 'Markdown' }
      );
    }
    return ctx.wizard.next();
  },

  // Step 3: Receive Credential 1, Ask for Credential 2
  async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text only.');
      return;
    }

    const text = ctx.message.text.trim();
    if (text === '/cancel') {
      await ctx.reply('❌ Cancelled.');
      return ctx.scene.leave();
    }

    state.credential1 = text;

    if (state.exchange === 'aster') {
      await ctx.reply(
        '✅ **API Key Received**\n\n' +
        '**Step 2 of 2:** Now send your **API Secret**',
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        '✅ **Address Received**\n\n' +
        '**Step 2 of 2:** Now send your **Private Key** (or API Wallet Private Key)',
        { parse_mode: 'Markdown' }
      );
    }
    return ctx.wizard.next();
  },

  // Step 4: Receive Credential 2, Execute Link
  async (ctx) => {
    const state = ctx.wizard.state as LinkState;
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please send text only.');
      return;
    }

    const text = ctx.message.text.trim();
    if (text === '/cancel') {
      await ctx.reply('❌ Cancelled.');
      return ctx.scene.leave();
    }

    state.credential2 = text;

    await ctx.reply('⏳ Validating capabilities & saving credentials...');

    // Execute Linking
    let userId = ctx.session.userId;

    console.log('[LinkDebug] Current Session UserId:', userId);
    console.log('[LinkDebug] Wizard State:', JSON.stringify(state));

    // Ensure User exists
    if (!userId) {
      const userRes = await ApiClient.createUser(ctx.from?.id!, ctx.from?.username);
      if (!userRes.success || !userRes.data) {
        await ctx.reply(`❌ Failed to register user: ${userRes.error}`);
        return ctx.scene.leave();
      }
      userId = userRes.data.id;
      ctx.session.userId = userId;
      console.log('[LinkDebug] Created new UserId:', userId);
    }

    console.log('[LinkDebug] Calling linkCredentials with:', { userId, exchange: state.exchange });

    try {
      const credentials: any = {};
      if (state.exchange === 'aster') {
        credentials.apiKey = state.credential1;
        credentials.apiSecret = state.credential2;
      } else {
        credentials.address = state.credential1;
        credentials.privateKey = state.credential2;
      }

      const linkRes = await ApiClient.linkCredentials(userId, state.exchange!, credentials);

      if (!linkRes.success) {
        throw new Error(linkRes.error || 'API Rejected Credentials');
      }

      // Generate Session
      const sessRes = await ApiClient.createSession(userId, state.exchange);
      if (sessRes.success) {
        ctx.session.authToken = sessRes.token;
        ctx.session.activeExchange = sessRes.activeExchange;
        ctx.session.linkedExchanges = sessRes.linkedExchanges;
        ctx.session.isLinked = true;
      } else {
        await ctx.reply('⚠️ Credentials saved but failed to start session. Try /start again.');
      }

      await ctx.reply(
        `✅ **${state.exchange === 'aster' ? 'Aster' : 'Hyperliquid'} Linked Successfully!**\n\n` +
        `Ready to trade. Use the menu below.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 View Account', 'view_account')],
            [Markup.button.callback('📋 Menu', 'menu')]
          ])
        }
      );

    } catch (e: any) {
      await ctx.reply(`❌ **Linking Failed**\n\nError: ${e.message}\n\nPlease try again with /link`);
    }

    return ctx.scene.leave();
  }
);
