import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import { exitSceneToMenu } from '../utils/countdown';

interface LinkWizardState {
  exchange?: 'aster' | 'hyperliquid';
  cred1?: string;
  cred1Name?: string;
  cred2?: string;
  cred2Name?: string;
}

export const linkScene = new Scenes.WizardScene<BotContext>(
  'link',

  // Step 1: Show Mini-App button
  async (ctx) => {
    // Allow linking multiple exchanges - user can overwrite or add new ones
    // if (ctx.session.isLinked) ... removed blocker

    const miniAppUrl = process.env.MINI_APP_URL || 'https://your-mini-app-url.com';
    
    await ctx.reply(
      '🔗 **Link Your Exchange Account**\n\n' +
      'Connect your wallet via our secure Mini-App.\n\n' +
      '**Supported Exchanges:**\n' +
      '• 🌟 Aster DEX\n' +
      '• ⚡ Hyperliquid\n' +
      '• And more...\n\n' +
      '**Supported Wallets:**\n' +
      '• MetaMask\n' +
      '• Trust Wallet\n' +
      '• WalletConnect\n' +
      '• And more...',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🔐 Connect Wallet', miniAppUrl)],
          [Markup.button.callback('⌨️ Manual Entry (API Keys)', 'manual_link')],
          [Markup.button.callback('❌ Cancel', 'cancel_link')],
        ]),
      }
    );
    return ctx.wizard.next();
  },

  // Step 2: Handle Manual Link or Wait for Mini-App
  async (ctx) => {
    const callbackData = (ctx.callbackQuery as any)?.data;
    const state = ctx.wizard.state as LinkWizardState;

    // If user chose manual entry, show exchange selection
    if (callbackData === 'manual_link') {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '⌨️ **Manual API Key Entry**\n\n' +
        'Select the exchange you want to link:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🌟 Aster DEX', 'link_aster')],
            [Markup.button.callback('⚡ Hyperliquid', 'link_hyperliquid')],
            [Markup.button.callback('« Back', 'cancel_link')],
          ]),
        }
      );
      return; // Stay in same step
    }

    // Handle exchange selection for manual entry
    if (callbackData === 'link_aster') {
      state.exchange = 'aster';
      state.cred1Name = 'API Key';
      state.cred2Name = 'API Secret';
    } else if (callbackData === 'link_hyperliquid') {
      state.exchange = 'hyperliquid';
      state.cred1Name = 'Wallet Address';
      state.cred2Name = 'Private Key';
    } else {
      if (ctx.message) await ctx.reply('Please use the buttons above.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `🔗 **Link ${state.exchange.toUpperCase()}**\n\n` +
      `**Step 1 of 2:** Send your **${state.cred1Name}**`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_link')]]),
      }
    );
    return ctx.wizard.next();
  },

  // Step 3: Receive Cred 1
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      await exitSceneToMenu(ctx, '❌ Linking Cancelled');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as LinkWizardState;
    state.cred1 = text;

    await ctx.reply(
      `✅ **${state.cred1Name} received**\n\n` +
      `**Step 2 of 2:** Send your **${state.cred2Name}**`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_link')]]),
      }
    );
    return ctx.wizard.next();
  },

  // Step 4: Finalize
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      await exitSceneToMenu(ctx, '❌ Linking Cancelled');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as LinkWizardState;
    const userId = ctx.from!.id;
    state.cred2 = text;

    await ctx.reply(`⏳ Validating your ${state.exchange?.toUpperCase()} credentials...`);

    try {
      // Actually save credentials to database via API
      const response = await UniversalApiService.linkAccount(
        userId.toString(),
        state.exchange!,
        state.cred1!,
        state.cred2!
      );

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to link account');
      }

      // Update session after successful link
      ctx.session.userId = userId;
      ctx.session.isLinked = true;
      ctx.session.activeExchange = state.exchange;

      await exitSceneToMenu(
        ctx,
        `✅ **${state.exchange?.toUpperCase()} Successfully Linked!**\n\n` +
        `Your account is now connected and ready to trade.`
      );
      return ctx.scene.leave();
    } catch (error: any) {
      await exitSceneToMenu(ctx, `❌ **Linking Failed**\n\n${error.message}`);
      return ctx.scene.leave();
    }
  }
);

linkScene.action('cancel_link', async (ctx) => {
  await ctx.answerCbQuery();
  await exitSceneToMenu(ctx, '❌ **Linking Cancelled**');
  return ctx.scene.leave();
});

linkScene.leave(async (ctx) => {
  if (ctx.wizard) {
    Object.keys(ctx.wizard.state).forEach(key => delete (ctx.wizard.state as any)[key]);
  }
});
