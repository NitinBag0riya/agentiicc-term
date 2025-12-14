/**
 * Switch Exchange Scene
 * 
 * Allows users to switch between linked exchanges
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { getAllUserExchanges } from '../../db/users';
import { UniversalApiClient } from '../utils/api-client';
import { getExchangeEmoji, getExchangeName, type ExchangeId } from '../config';

export const switchExchangeScene = new Scenes.WizardScene<BotContext>(
  'switch-exchange',

  // Step 1: Show available exchanges
  async (ctx) => {
    console.log('[SwitchExchange] Step 1: Showing available exchanges');

    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply('❌ Session error. Please /start again.');
      return ctx.scene.leave();
    }

    try {
      // Get all linked exchanges
      const exchanges = await getAllUserExchanges(userId);

      if (exchanges.length === 0) {
        await ctx.reply('❌ No exchanges linked. Use /link to connect an exchange.');
        return ctx.scene.leave();
      }

      if (exchanges.length === 1) {
        await ctx.reply(
          `ℹ️ **Only One Exchange Linked**\n\n` +
          `You only have ${getExchangeName(exchanges[0] as ExchangeId)} linked.\n\n` +
          'Link another exchange with /link to enable switching.',
          { parse_mode: 'Markdown' }
        );
        return ctx.scene.leave();
      }

      // Build exchange selection buttons
      const buttons = exchanges.map(exchangeId => {
        const emoji = getExchangeEmoji(exchangeId as ExchangeId);
        const name = getExchangeName(exchangeId as ExchangeId);
        const isCurrent = exchangeId === ctx.session.activeExchange;
        const label = isCurrent ? `${emoji} ${name} ✅` : `${emoji} ${name}`;
        
        return [Markup.button.callback(label, `switch_to_${exchangeId}`)];
      });

      buttons.push([Markup.button.callback('❌ Cancel', 'cancel_switch')]);

      await ctx.reply(
        '🔄 **Switch Exchange**\n\n' +
        `Current: ${getExchangeEmoji(ctx.session.activeExchange as ExchangeId)} ${getExchangeName(ctx.session.activeExchange as ExchangeId)}\n\n` +
        'Select exchange to switch to:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error('[SwitchExchange] Error:', error);
      await ctx.reply('❌ Failed to load exchanges. Please try again.');
      return ctx.scene.leave();
    }
  }
);

// Handle exchange selection
switchExchangeScene.action(/^switch_to_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const exchangeId = ctx.match[1] as ExchangeId;
  const userId = ctx.session.userId;

  if (!userId) {
    await ctx.reply('❌ Session error. Please /start again.');
    return ctx.scene.leave();
  }

  console.log(`[SwitchExchange] Switching to ${exchangeId}`);

  try {
    // Remove buttons
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          messageId,
          undefined,
          undefined
        );
      } catch (e) {
        // Ignore
      }
    }

    // Show loading
    await ctx.reply(
      `⏳ **Switching to ${getExchangeName(exchangeId)}...**\n\n` +
      'Please wait...',
      { parse_mode: 'Markdown' }
    );

    // Create new API session
    const apiClient = new UniversalApiClient();
    const token = await apiClient.createSession(userId, exchangeId);

    // Update session
    ctx.session.activeExchange = exchangeId;
    if (!ctx.session.apiTokens) {
      ctx.session.apiTokens = {};
    }
    ctx.session.apiTokens[exchangeId] = token;

    console.log(`[SwitchExchange] ✅ Switched to ${exchangeId}`);

    // Show success
    await ctx.reply(
      `✅ **Exchange Switched!**\n\n` +
      `${getExchangeEmoji(exchangeId)} Now using **${getExchangeName(exchangeId)}**\n\n` +
      'Use /menu to continue trading.',
      { parse_mode: 'Markdown' }
    );

    return ctx.scene.leave();
  } catch (error) {
    console.error('[SwitchExchange] Error switching:', error);
    await ctx.reply(
      '❌ **Failed to Switch Exchange**\n\n' +
      'Please try again or contact support.',
      { parse_mode: 'Markdown' }
    );
    return ctx.scene.leave();
  }
});

// Handle cancel
switchExchangeScene.action('cancel_switch', async (ctx) => {
  await ctx.answerCbQuery();
  
  console.log('[SwitchExchange] Cancelled');

  await ctx.reply(
    '❌ **Switch Cancelled**\n\n' +
    'Your exchange remains unchanged.',
    { parse_mode: 'Markdown' }
  );

  return ctx.scene.leave();
});

// Leave handler
switchExchangeScene.leave(async (ctx) => {
  console.log('[SwitchExchange] Exited');
  if (ctx.wizard) {
    (ctx.wizard as any).state = {};
  }
});
