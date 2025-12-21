/**
 * Unlink Scene - Allows users to unlink their exchange credentials
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { deleteApiCredentials, getApiCredentials } from '../../db/users';
import { showMenu } from '../utils/menu';

export const unlinkScene = new Scenes.WizardScene<BotContext>(
  'unlink',
  
  // Step 0: Confirm unlink
  async (ctx) => {
    const userId = ctx.session.userId;
    const activeExchange = ctx.session.activeExchange;
    
    if (!userId || !activeExchange) {
      await ctx.reply('❌ No linked exchange found.');
      return ctx.scene.leave();
    }
    
    // Check if credentials exist
    const creds = await getApiCredentials(userId, activeExchange);
    if (!creds) {
      await ctx.reply('❌ No credentials found for this exchange.');
      ctx.session.isLinked = false;
      return ctx.scene.leave();
    }
    
    await ctx.reply(
      `⚠️ **Unlink ${activeExchange === 'aster' ? 'Aster' : 'Hyperliquid'}?**\n\n` +
      'This will remove your stored credentials.\n\n' +
      'Are you sure?',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes, Unlink', 'unlink_confirm'),
            Markup.button.callback('❌ Cancel', 'unlink_cancel')
          ]
        ])
      }
    );
    
    return ctx.wizard.next();
  },
  
  // Step 1: Process unlink confirmation
  async (ctx) => {
    // Handled by action handlers
    return;
  }
);

// Global Commands
unlinkScene.command(['menu', 'start'], async (ctx) => {
    await ctx.scene.leave();
    await showMenu(ctx);
});

// Action handlers
unlinkScene.action('unlink_confirm', async (ctx) => {
  const userId = ctx.session.userId;
  const activeExchange = ctx.session.activeExchange;
  
  if (!userId || !activeExchange) {
    await ctx.answerCbQuery('❌ Error');
    return ctx.scene.leave();
  }
  
  try {
    await deleteApiCredentials(userId, activeExchange);
    
    // Check if other exchanges are still linked
    const { getLinkedExchanges } = require('../../db/users');
    const remainingExchanges = await getLinkedExchanges(userId);
    
    if (remainingExchanges.length > 0) {
        // Switch to another exchange
        const nextExchange = remainingExchanges[0];
        ctx.session.activeExchange = nextExchange;
        ctx.session.isLinked = true;
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          `✅ **${activeExchange === 'aster' ? 'Aster' : 'Hyperliquid'} Unlinked**\n\n` +
          `Switched active exchange to **${nextExchange === 'aster' ? 'Aster' : 'Hyperliquid'}**.`
        );
    } else {
        // No exchanges left
        ctx.session.isLinked = false;
        ctx.session.activeExchange = undefined;
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          `✅ **${activeExchange === 'aster' ? 'Aster' : 'Hyperliquid'} Unlinked**\n\n` +
          'All exchanges removed.\n' +
          'Use /link to connect an exchange.',
          { parse_mode: 'Markdown' }
        );
    }
    
  } catch (error: any) {
    await ctx.answerCbQuery('❌ Failed');
    await ctx.reply(`Error: ${error.message}`);
  }
  
  return ctx.scene.leave();
});

unlinkScene.action('unlink_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Unlink cancelled.');
  return ctx.scene.leave();
});
