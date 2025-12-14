// Close position handler
mainMenuComposer.action('close_position', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '❌ **Close Position**\n\n' +
    'Enter the symbol of the position to close (e.g., SOLUSDT):',
    { parse_mode: 'Markdown' }
  );
});

// View open orders
mainMenuComposer.action('view_orders', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  const { formatError } = await import('../utils/formatters');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    const client = new UniversalApiClient(token);
    const orders = await client.getOpenOrders();
    
    if (!orders || orders.length === 0) {
      await ctx.reply('📋 **Open Orders**\n\nNo open orders', { parse_mode: 'Markdown' });
      return;
    }

    let message = '📋 **Open Orders**\n\n';
    orders.forEach((order: any, index: number) => {
      message += `${index + 1}. **${order.symbol}** ${order.side}\n`;
      message += `   Type: ${order.type} | Qty: ${order.quantity}\n`;
      if (order.price) message += `   Price: $${order.price}\n`;
      message += `   Status: ${order.status}\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚫 Cancel All', 'cancel_all_orders')],
        [Markup.button.callback('🔙 Back', 'view_positions')],
      ])
    });
  } catch (error) {
    console.error('[Orders] Error:', error);
    await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
  }
});

// Cancel all orders
mainMenuComposer.action('cancel_all_orders', async (ctx) => {
  await ctx.answerCbQuery();
  
  await ctx.reply(
    '⚠️ **Cancel All Orders**\n\n' +
    'Are you sure you want to cancel ALL open orders?',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, Cancel All', 'confirm_cancel_all')],
        [Markup.button.callback('❌ No, Go Back', 'view_positions')],
      ])
    }
  );
});

// Confirm cancel all
mainMenuComposer.action('confirm_cancel_all', async (ctx) => {
  await ctx.answerCbQuery();
  
  const { UniversalApiClient } = await import('../utils/api-client');
  
  try {
    const token = ctx.session.apiTokens?.[ctx.session.activeExchange!];
    if (!token) {
      await ctx.reply('❌ Session expired. Please /link again.');
      return;
    }

    await ctx.reply('⏳ Canceling all orders...');

    const client = new UniversalApiClient(token);
    await client.cancelAllOrders();
    
    await ctx.reply(
      '✅ **All Orders Cancelled**\n\n' +
      'All open orders have been cancelled.',
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('[CancelAll] Error:', error);
    await ctx.reply(
      `❌ **Failed to Cancel Orders**\n\n` +
      `Error: ${error.message}`,
      { parse_mode: 'Markdown' }
    );
  }
});

export { mainMenuComposer };
