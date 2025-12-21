import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';

export const orderExecutingScene = new Scenes.BaseScene<BotContext>('order_executing');

// Enter handler - Screen 31: Order Executing
orderExecutingScene.enter(async (ctx) => {
  const symbol = ctx.session.tradingSymbol || 'SOLUSDT';
  const side = ctx.session.orderSide || 'LONG';
  const amount = ctx.session.orderAmount || 50;
  const orderType = ctx.session.orderType || 'Market';
  const leverage = ctx.session.leverage || 10;
  const exchange = ctx.session.activeExchange || 'aster';
  const userId = ctx.from?.id?.toString();
  
  const { createBox } = require('../utils/format');

  const lines = [
    '⏳ Executing Order',
    '',
    `Placing ${side} order...`,
    '▓▓▓▓▓▓░░░░░░░░░░░░░',
    '',
    `Symbol: ${symbol}`,
    `Amount: $${amount}`,
    '',
    'Please wait...'
  ];

  const message = createBox('', lines, 32);

  await ctx.reply('```\n' + message + '\n```', { parse_mode: 'MarkdownV2' });
  
  try {
    if (userId) {
      const { getOrCreateUser } = require('../../db/users');
      // @ts-ignore
      const user = await getOrCreateUser(parseInt(userId), ctx.from?.username);
      const uid = user.id;

      // 1. Fetch current price to calculate quantity
      const ticker = await UniversalApiService.getMarketPrice(exchange, symbol);
      const price = parseFloat(ticker.price);
      
      // 2. Fetch Asset Info for Precision (Step Size) and Limits
      const assetInfo = await UniversalApiService.getAsset(exchange, symbol);
      const stepSize = assetInfo?.stepSize ? parseFloat(assetInfo.stepSize) : 0.001; // Default to 0.001
      const minQty = assetInfo?.minQuantity ? parseFloat(assetInfo.minQuantity) : 0;

      // 3. Calculate Notional and Quantity
      // User Amount is Margin (Cost). Notional = Margin * Leverage
      const notional = amount * leverage; 
      const rawQuantity = notional / price;
      
      // 4. Round down to nearest stepSize
      const quantity = Math.floor(rawQuantity / stepSize) * stepSize;
      
      // 5. Validate Quantity
      if (quantity === 0) {
        const minUsd = (stepSize * price).toFixed(2);
        throw new Error(`Order size too small. Minimum required is approx $${minUsd} (${stepSize} ${symbol.replace('USDT', '')}). Increase amount or leverage.`);
      }

      if (minQty > 0 && quantity < minQty) {
        const minUsd = (minQty * price).toFixed(2);
        throw new Error(`Order size too small. Minimum quantity is ${minQty} (~$${minUsd}).`);
      }

      // Fix float artifacts and format matches decimals
      const decimals = (stepSize.toString().split('.')[1] || '').length;
      const formattedQty = quantity.toFixed(decimals);

      const orderSide = side === 'LONG' ? 'BUY' : 'SELL';
      
      const result = await UniversalApiService.placeOrder(uid, exchange, {
        symbol,
        side: orderSide,
        type: orderType.toUpperCase(),
        quantity: formattedQty,
        leverage,
      });
      
      if (result && result.orderId) {
        ctx.session.lastOrderId = result.orderId;
        ctx.session.lastOrderResult = result;
        await ctx.scene.enter('order_success');
      } else {
        throw new Error('Order failed - no order ID returned');
      }
    }
  } catch (error: any) {
    console.error('Order execution error:', error);
    ctx.session.lastOrderError = error.message || 'Unknown error occurred';
    await ctx.scene.enter('order_error');
  }
});

export default orderExecutingScene;
