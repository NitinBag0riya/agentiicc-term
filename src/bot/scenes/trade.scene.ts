/**
 * Trade Scene - Comprehensive Trading UI
 * 
 * Multi-step wizard for placing all order types via Universal API
 */

import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiClient } from '../utils/api-client';
import { getExchangeEmoji, getExchangeName } from '../config';

interface TradeState {
  symbol?: string;
  side?: 'BUY' | 'SELL';
  orderType?: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'TRAILING_STOP';
  quantity?: string;
  price?: string;
  triggerPrice?: string;
  trailingDelta?: string;
  leverage?: number;
  marginType?: 'CROSS' | 'ISOLATED';
  reduceOnly?: boolean;
}

const POPULAR_SYMBOLS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP'];

export const tradeScene = new Scenes.WizardScene<BotContext>(
  'trade',

  // ==================== STEP 1: Symbol Selection ====================
  async (ctx) => {
    console.log('[Trade] Step 1: Symbol selection');

    const state = ctx.wizard.state as TradeState;
    Object.keys(state).forEach(key => delete state[key as keyof TradeState]);

    // Organize symbols in rows of 3
    const buttons = [];
    for (let i = 0; i < POPULAR_SYMBOLS.length; i += 3) {
      const row = POPULAR_SYMBOLS.slice(i, i + 3).map(symbol => 
        Markup.button.callback(symbol, `symbol_${symbol}`)
      );
      buttons.push(row);
    }
    buttons.push([Markup.button.callback('📝 Custom', 'symbol_custom')]);
    buttons.push([Markup.button.callback('❌ Cancel', 'cancel_trade')]);

    await ctx.reply(
      '📈 **New Trade**\\n\\n' +
      'Select a trading pair:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );

    return ctx.wizard.next();
  },

  // ==================== STEP 2: Side Selection ====================
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    const state = ctx.wizard.state as TradeState;
    const input = ctx.message.text.trim().toUpperCase();

    // Check if we're in search mode
    if ((state as any).searchingSymbol) {
      try {
        // Search for the symbol
        const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
        if (!token) {
          await ctx.reply('❌ Session expired. Please /link again.');
          return ctx.scene.leave();
        }

        const client = new UniversalApiClient(token);
        await ctx.reply('🔍 Searching...');
        
        const results = await client.searchAssets(input);
        
        if (!results || results.length === 0) {
          await ctx.reply(
            `❌ **No Results**\n\n` +
            `Symbol "${input}" not found on any exchange.\n\n` +
            'Try another search or /menu to go back.',
            { parse_mode: 'Markdown' }
          );
          return;
        }

        // Show results with exchange availability
        let message = `🔍 **Search Results for "${input}"**\n\n`;
        
        results.forEach((asset: any, index: number) => {
          const exchange = asset.exchange === 'aster' ? '⭐ Aster' : '🌊 Hyperliquid';
          message += `${index + 1}. **${asset.symbol}**\n`;
          message += `   ${exchange}\n`;
          if (asset.name) message += `   ${asset.name}\n`;
          message += `\n`;
        });

        message += 'Enter the exact symbol to trade:';

        await ctx.reply(message, { parse_mode: 'Markdown' });
        
        // Clear search flag
        delete (state as any).searchingSymbol;
        return;
        
      } catch (error: any) {
        await ctx.reply(
          `❌ **Search Failed**\n\n` +
          `Error: ${error.message}\n\n` +
          'Try again or /menu to go back.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
    }

    // Normal symbol validation
    const symbol = input;

    // Validate symbol format
    if (!symbol.includes('-') && !symbol.includes('USDT')) {
      await ctx.reply('❌ Invalid symbol format. Please use format like BTC-PERP or BTCUSDT');
      return;
    }

    state.symbol = symbol;

    await ctx.reply(
      `📊 **${symbol}**\n\n` +
      'Select order side:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📈 LONG (BUY)', 'side_BUY'), Markup.button.callback('📉 SHORT (SELL)', 'side_SELL')],
          [Markup.button.callback('❌ Cancel', 'cancel_trade')],
        ])
      }
    );

    return ctx.wizard.next();
  },

  // ==================== STEP 3: Order Type Selection ====================
  async (ctx) => {
    // This step is handled by action handlers
    return;
  },

  // ==================== STEP 4: Parameter Input ====================
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    const state = ctx.wizard.state as TradeState;
    const input = ctx.message.text.trim();

    // Handle different parameter inputs based on order type
    if (!state.quantity) {
      // First input is always quantity
      if (isNaN(parseFloat(input)) || parseFloat(input) <= 0) {
        await ctx.reply('❌ Invalid quantity. Please enter a positive number:');
        return;
      }
      state.quantity = input;

      // Ask for next parameter based on order type
      if (state.orderType === 'MARKET') {
        // Market order: ask for leverage
        await ctx.reply(
          '⚡ **Leverage**\\n\\n' +
          'Enter leverage (1-20x) or send 0 to skip:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('1x', 'lev_1'), Markup.button.callback('5x', 'lev_5'), Markup.button.callback('10x', 'lev_10')],
              [Markup.button.callback('15x', 'lev_15'), Markup.button.callback('20x', 'lev_20'), Markup.button.callback('Skip', 'lev_0')],
              [Markup.button.callback('❌ Cancel', 'cancel_trade')],
            ])
          }
        );
      } else if (state.orderType === 'LIMIT') {
        // Limit order: ask for price
        await ctx.reply(
          '💰 **Limit Price**\\n\\n' +
          'Enter your limit price:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_trade')]])
          }
        );
      } else if (state.orderType === 'STOP_LOSS' || state.orderType === 'TAKE_PROFIT') {
        // SL/TP: ask for trigger price
        await ctx.reply(
          `🎯 **Trigger Price**\\n\\n` +
          'Enter trigger price:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_trade')]])
          }
        );
      } else if (state.orderType === 'TRAILING_STOP') {
        // Trailing stop: ask for delta
        await ctx.reply(
          '📈 **Trailing Delta**\\n\\n' +
          'Enter trailing delta (%) or absolute value:',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('1%', 'delta_1'), Markup.button.callback('2%', 'delta_2'), Markup.button.callback('5%', 'delta_5')],
              [Markup.button.callback('❌ Cancel', 'cancel_trade')],
            ])
          }
        );
      }
      return;
    }

    if (state.orderType === 'LIMIT' && !state.price) {
      // Second input for limit order is price
      if (isNaN(parseFloat(input)) || parseFloat(input) <= 0) {
        await ctx.reply('❌ Invalid price. Please enter a positive number:');
        return;
      }
      state.price = input;

      // Ask for leverage
      await ctx.reply(
        '⚡ **Leverage**\\n\\n' +
        'Enter leverage (1-20x) or send 0 to skip:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('1x', 'lev_1'), Markup.button.callback('5x', 'lev_5'), Markup.button.callback('10x', 'lev_10')],
            [Markup.button.callback('Skip', 'lev_0')],
            [Markup.button.callback('❌ Cancel', 'cancel_trade')],
          ])
        }
      );
      return;
    }

    if ((state.orderType === 'STOP_LOSS' || state.orderType === 'TAKE_PROFIT') && !state.triggerPrice) {
      // Trigger price input
      if (isNaN(parseFloat(input)) || parseFloat(input) <= 0) {
        await ctx.reply('❌ Invalid trigger price. Please enter a positive number:');
        return;
      }
      state.triggerPrice = input;
      state.reduceOnly = true; // Auto-enable for SL/TP

      // Show confirmation
      return showConfirmation(ctx);
    }

    if (state.orderType === 'TRAILING_STOP' && !state.trailingDelta) {
      // Trailing delta input
      if (isNaN(parseFloat(input)) || parseFloat(input) <= 0) {
        await ctx.reply('❌ Invalid trailing delta. Please enter a positive number:');
        return;
      }
      state.trailingDelta = input;

      // Show confirmation
      return showConfirmation(ctx);
    }

    // Leverage input
    const lev = parseInt(input);
    if (isNaN(lev) || lev < 0 || lev > 20) {
      await ctx.reply('❌ Invalid leverage. Please enter a number between 0-20:');
      return;
    }
    state.leverage = lev === 0 ? undefined : lev;

    // Show confirmation
    return showConfirmation(ctx);
  }
);

// Helper function to show order confirmation
async function showConfirmation(ctx: BotContext) {
  const state = ctx.wizard.state as TradeState;

  let summary = `📋 **Order Summary**\\n\\n`;
  summary += `**Symbol:** ${state.symbol}\\n`;
  summary += `**Side:** ${state.side === 'BUY' ? '📈 LONG' : '📉 SHORT'}\\n`;
  summary += `**Type:** ${state.orderType}\\n`;
  summary += `**Quantity:** ${state.quantity}\\n`;

  if (state.price) summary += `**Price:** $${state.price}\\n`;
  if (state.triggerPrice) summary += `**Trigger:** $${state.triggerPrice}\\n`;
  if (state.trailingDelta) summary += `**Trailing Delta:** ${state.trailingDelta}%\\n`;
  if (state.leverage) summary += `**Leverage:** ${state.leverage}x\\n`;
  if (state.marginType) summary += `**Margin:** ${state.marginType}\\n`;
  if (state.reduceOnly) summary += `**Reduce Only:** Yes\\n`;

  summary += `\\n⚠️ **Confirm this order?**`;

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm & Place Order', 'confirm_order')],
      [Markup.button.callback('❌ Cancel', 'cancel_trade')],
    ])
  });

  return ctx.wizard.next();
}

// ==================== Action Handlers ====================

// Symbol selection
POPULAR_SYMBOLS.forEach(symbol => {
  tradeScene.action(`symbol_${symbol}`, async (ctx) => {
    await ctx.answerCbQuery();
    const state = ctx.wizard.state as TradeState;
    state.symbol = symbol;

    await ctx.reply(
      `📊 **${symbol}**\\n\\n` +
      'Select order side:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📈 LONG (BUY)', 'side_BUY'), Markup.button.callback('📉 SHORT (SELL)', 'side_SELL')],
          [Markup.button.callback('❌ Cancel', 'cancel_trade')],
        ])
      }
    );

    return ctx.wizard.selectStep(2);
  });
});

tradeScene.action('symbol_custom', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '🔍 **Search Symbol**\n\n' +
    'Enter symbol to search (e.g., ETH, BTC, SOL):\n\n' +
    'I\'ll show you which exchanges support it.',
    { parse_mode: 'Markdown' }
  );
  
  // Set a flag to indicate we're waiting for symbol search
  const state = ctx.wizard.state as TradeState;
  (state as any).searchingSymbol = true;
  
  return ctx.wizard.selectStep(1);
});

// Side selection
tradeScene.action(/^side_(BUY|SELL)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;
  state.side = ctx.match[1] as 'BUY' | 'SELL';

  await ctx.reply(
    `${state.side === 'BUY' ? '📈 LONG' : '📉 SHORT'} **${state.symbol}**\\n\\n` +
    'Select order type:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        // Row 1: Common orders (2 buttons)
        [Markup.button.callback('🚀 Market', 'type_MARKET'), Markup.button.callback('📊 Limit', 'type_LIMIT')],
        // Row 2: Advanced orders (3 buttons)
        [Markup.button.callback('🛡️ Stop Loss', 'type_STOP_LOSS'), Markup.button.callback('🎯 Take Profit', 'type_TAKE_PROFIT'), Markup.button.callback('📈 Trailing', 'type_TRAILING_STOP')],
        // Row 3: Cancel
        [Markup.button.callback('❌ Cancel', 'cancel_trade')],
      ])
    }
  );

  return ctx.wizard.selectStep(2);
});

// Order type selection
tradeScene.action(/^type_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;
  state.orderType = ctx.match[1] as any;

  await ctx.reply(
    `💼 **${state.orderType} Order**\\n\\n` +
    'Enter quantity:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'cancel_trade')]])
    }
  );

  return ctx.wizard.selectStep(3);
});

// Leverage selection
tradeScene.action(/^lev_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;
  const lev = parseInt(ctx.match[1]);
  state.leverage = lev === 0 ? undefined : lev;

  // Ask for margin type if leverage is set
  if (state.leverage && state.leverage > 1) {
    await ctx.reply(
      '⚖️ **Margin Type**\\n\\n' +
      'Select margin type:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🌐 Cross', 'margin_CROSS'), Markup.button.callback('🔒 Isolated', 'margin_ISOLATED')],
          [Markup.button.callback('❌ Cancel', 'cancel_trade')],
        ])
      }
    );
    return;
  }

  return showConfirmation(ctx);
});

// Margin type selection
tradeScene.action(/^margin_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;
  state.marginType = ctx.match[1] as 'CROSS' | 'ISOLATED';

  return showConfirmation(ctx);
});

// Trailing delta selection
tradeScene.action(/^delta_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;
  state.trailingDelta = ctx.match[1];

  return showConfirmation(ctx);
});

// Confirm order
tradeScene.action('confirm_order', async (ctx) => {
  await ctx.answerCbQuery();
  const state = ctx.wizard.state as TradeState;

  try {
    // Remove buttons
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(ctx.chat?.id, messageId, undefined, undefined);
      } catch (e) { /* ignore */ }
    }

    await ctx.reply('⏳ **Placing Order...**\\n\\nPlease wait...', { parse_mode: 'Markdown' });

    // Get API token
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return ctx.scene.leave();
    }

    // Place order via Universal API
    const client = new UniversalApiClient(token);
    const orderParams: any = {
      symbol: state.symbol!,
      side: state.side!,
      type: state.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
      quantity: state.quantity,
    };

    if (state.price) orderParams.price = state.price;
    if (state.triggerPrice) orderParams.triggerPrice = state.triggerPrice;
    if (state.trailingDelta) orderParams.trailingDelta = state.trailingDelta;
    if (state.leverage) orderParams.leverage = state.leverage;
    if (state.reduceOnly) orderParams.reduceOnly = true;

    console.log('[Trade] Placing order:', orderParams);
    const result = await client.placeOrder(orderParams);
    console.log('[Trade] Order result:', JSON.stringify(result, null, 2));

    // Validate that we got a real response
    if (!result || result === undefined) {
      throw new Error('No response from exchange API - order may not have been placed');
    }

    const exchangeEmoji = getExchangeEmoji(ctx.session.activeExchange as any);
    const exchangeName = getExchangeName(ctx.session.activeExchange as any);

    // Extract order ID from various possible response structures
    let orderId = 'N/A';
    if (result) {
      orderId = result.orderId || result.id || result.order_id || result.clientOrderId || 'Success';
    }

    await ctx.reply(
      `✅ **Order Placed Successfully!**\\n\\n` +
      `${exchangeEmoji} ${exchangeName}\\n` +
      `**Order ID:** \`${orderId}\`\\n` +
      `**Symbol:** ${state.symbol}\\n` +
      `**Side:** ${state.side}\\n` +
      `**Type:** ${state.orderType}\\n` +
      `**Quantity:** ${state.quantity}\\n` +
      (state.leverage ? `**Leverage:** ${state.leverage}x\\n` : '') +
      (state.marginType ? `**Margin:** ${state.marginType}\\n` : '') +
      `\\nUse /menu to view positions.`,
      { parse_mode: 'Markdown' }
    );

    return ctx.scene.leave();
  } catch (error: any) {
    console.error('[Trade] Error placing order:', error);
    
    // Better error message
    let errorMsg = error.message || 'Unknown error';
    if (error.response?.data?.message) {
      errorMsg = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorMsg = error.response.data.error;
    }
    
    await ctx.reply(
      `❌ **Order Failed**\\n\\n` +
      `Error: ${errorMsg}\\n\\n` +
      'Please check:\\n' +
      '• Sufficient balance\\n' +
      '• Valid symbol\\n' +
      '• Exchange API status',
      { parse_mode: 'Markdown' }
    );
    return ctx.scene.leave();
  }
});

// Cancel trade
tradeScene.action('cancel_trade', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('❌ **Trade Cancelled**', { parse_mode: 'Markdown' });
  return ctx.scene.leave();
});

// Leave handler
tradeScene.leave(async (ctx) => {
  console.log('[Trade] Exited');
  if (ctx.wizard) {
    (ctx.wizard as any).state = {};
  }
});
