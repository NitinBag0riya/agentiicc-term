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
  // Step 0: Select exchange to unlink
  async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) {
      // Try to recover user id
      const { getOrCreateUser } = require('../../db/users');
      const user = await getOrCreateUser(ctx.from?.id, ctx.from?.username);
      ctx.session.userId = user.id;
    }
    
    // Fetch actual linked exchanges from DB
    const { getLinkedExchanges } = require('../../db/users');
    // @ts-ignore
    const linkedExchanges = await getLinkedExchanges(ctx.session.userId);
    
    if (!linkedExchanges || linkedExchanges.length === 0) {
      await ctx.reply('❌ No linked exchanges found to unlink.');
      return ctx.scene.leave();
    }
    
    // Save state
    ctx.scene.session.state = { linkedExchanges };
    
    // If only one, confirm it directly
    if (linkedExchanges.length === 1) {
       const target = linkedExchanges[0];
       // @ts-ignore
       ctx.scene.session.state.targetExchange = target;
       
       await ctx.reply(
          `⚠️ **Unlink ${target === 'aster' ? 'Aster' : 'Hyperliquid'}?**\n\n` +
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
    }
    
    // If multiple, ask user to choose
    const buttons = linkedExchanges.map((ex: string) => 
        Markup.button.callback(
            ex === 'aster' ? '❌ Unlink Aster' : '❌ Unlink Hyperliquid', 
            `select_${ex}`
        )
    );
    buttons.push(Markup.button.callback('🔙 Cancel', 'unlink_cancel'));
    
    await ctx.reply(
      '❓ **Select exchange to unlink:**',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([buttons])
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
// Handle Selection
unlinkScene.action(/select_(.+)/, async (ctx) => {
  const target = ctx.match[1];
  // @ts-ignore
  ctx.scene.session.state.targetExchange = target;
  
  await ctx.answerCbQuery();
  await ctx.editMessageText(
      `⚠️ **Unlink ${target === 'aster' ? 'Aster' : 'Hyperliquid'}?**\n\n` +
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
});

// Action handlers
unlinkScene.action('unlink_confirm', async (ctx) => {
  const userId = ctx.session.userId;
  // @ts-ignore
  const targetExchange = ctx.scene.session.state.targetExchange || ctx.session.activeExchange;
  
  if (!userId || !targetExchange) {
    await ctx.answerCbQuery('❌ Error');
    return ctx.scene.leave();
  }
  
  try {
    await deleteApiCredentials(userId, targetExchange);
    
    // Check if other exchanges are still linked
    const { getLinkedExchanges } = require('../../db/users');
    const remainingExchanges = await getLinkedExchanges(userId);
    
    if (remainingExchanges.length > 0) {
        // Switch to another exchange
        const nextExchange = remainingExchanges[0];
        ctx.session.activeExchange = nextExchange;
        ctx.session.isLinked = true;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          `✅ **${targetExchange === 'aster' ? 'Aster' : 'Hyperliquid'} Unlinked**\n\n` +
          `Switched active exchange to **${nextExchange === 'aster' ? 'Aster' : 'Hyperliquid'}**.`
        );
        return ctx.scene.enter('universal_citadel');
    } else {
        // No exchanges left
        ctx.session.isLinked = false;
        ctx.session.activeExchange = undefined;
        
        await ctx.answerCbQuery();
        await ctx.reply(
          `✅ **${targetExchange === 'aster' ? 'Aster' : 'Hyperliquid'} Unlinked**\n\n` +
          'All exchanges removed.'
        );
        return ctx.scene.enter('welcome');
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
