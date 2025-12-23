/**
 * Overview Menu Composer - Command Citadel
 *
 * Handles the main account overview showing perp positions, spot assets, and total portfolio value
 */
import { Composer, Markup } from 'telegraf';
import { BotContext } from '../types/context';
import { getRedis } from '../db/redis';
import { getPostgres } from '../db/postgres';
import { UniversalApiClient } from '../services/universalApi';
import { getBotDeepLink } from '../utils/botInfo';
import { getSpotPrices } from '../services/priceCache.service';
import { cleanupButtonMessages, trackButtonMessage } from '../utils/buttonCleanup';

export const overviewMenuComposer = new Composer<BotContext>();

// Re-export for backwards compatibility with bot.ts
export { cleanupButtonMessages, trackButtonMessage };

// ========== TEMPORARY: Formatting Style Functions ==========

function formatPositionStyle1(p: any, index: number, initialMargin: number, pnlPercent: number, unrealizedPnl: number, leverage: number, marginType: string, baseAsset: string, notional: number, entryPrice: number, markPrice: number, liquidationPrice: number): string {
  const emoji = unrealizedPnl >= 0 ? '📈' : '📉';
  const pnlPercentSign = pnlPercent >= 0 ? '+' : '';
  const pnlUsdSign = unrealizedPnl >= 0 ? '+' : '';
  const positionAmt = Math.abs(parseFloat(p.positionAmt));

  return `<b>${p.symbol}</b> (${leverage.toFixed(0)}x ${marginType}) ${emoji}\n<b>${pnlPercentSign}${pnlPercent.toFixed(2)}%</b> (${pnlUsdSign}$${unrealizedPnl.toFixed(2)})\n${positionAmt.toFixed(4)} ${baseAsset} / $${notional.toFixed(0)} | Margin $${initialMargin.toFixed(2)}\nEntry $${entryPrice.toFixed(2)} | Mark $${markPrice.toFixed(2)}\nLiq $${liquidationPrice.toFixed(2)}\n\n`;
}

function formatPositionStyle2(p: any, index: number, initialMargin: number, pnlPercent: number, unrealizedPnl: number, leverage: number, marginType: string, baseAsset: string, notional: number, entryPrice: number, markPrice: number, liquidationPrice: number): string {
  const emoji = unrealizedPnl >= 0 ? '📈' : '📉';
  const pnlPercentSign = pnlPercent >= 0 ? '+' : '';
  const pnlUsdSign = unrealizedPnl >= 0 ? '+' : '';
  const positionAmt = Math.abs(parseFloat(p.positionAmt));

  return `<b>${p.symbol}</b> (${leverage.toFixed(0)}x ${marginType}) ${emoji}\n<b>${pnlPercentSign}${pnlPercent.toFixed(2)}%</b> (${pnlUsdSign}$${unrealizedPnl.toFixed(2)})\n• ${positionAmt.toFixed(4)} ${baseAsset} / $${notional.toFixed(0)}\n• Margin: $${initialMargin.toFixed(2)}\n• Entry $${entryPrice.toFixed(2)} | Mark $${markPrice.toFixed(2)}\n• Liq $${liquidationPrice.toFixed(2)}\n\n`;
}

function formatPositionStyle3(p: any, index: number, initialMargin: number, pnlPercent: number, unrealizedPnl: number, leverage: number, marginType: string, baseAsset: string, notional: number, entryPrice: number, markPrice: number, liquidationPrice: number): string {
  const emoji = unrealizedPnl >= 0 ? '📈' : '📉';
  const pnlPercentSign = pnlPercent >= 0 ? '+' : '';
  const pnlUsdSign = unrealizedPnl >= 0 ? '+' : '';
  const positionAmt = Math.abs(parseFloat(p.positionAmt));

  return `─────────────────────\n<b>${p.symbol}</b> (${leverage.toFixed(0)}x ${marginType}) ${emoji}\n<b>${pnlPercentSign}${pnlPercent.toFixed(2)}%</b> (${pnlUsdSign}$${unrealizedPnl.toFixed(2)})\nPos: ${positionAmt.toFixed(4)} ${baseAsset} / $${notional.toFixed(0)}\nMargin: $${initialMargin.toFixed(2)}\nEntry $${entryPrice.toFixed(2)} → Mark $${markPrice.toFixed(2)}\nLiq $${liquidationPrice.toFixed(2)}\n\n`;
}

/**
 * Calculate FIFO cost basis PnL for spot asset
 * Returns { avgCost, unrealizedPnl, unrealizedPnlPercent }
 */
function calculateFIFOPnL(
  trades: Array<{
    buyer: boolean;
    price: string;
    qty: string;
    quoteQty: string;
    time: number;
  }>,
  currentHolding: number,
  currentPrice: number
): { avgCost: number; unrealizedPnl: number; unrealizedPnlPercent: number } {
  if (!trades || trades.length === 0 || currentHolding === 0) {
    return { avgCost: 0, unrealizedPnl: 0, unrealizedPnlPercent: 0 };
  }

  // Sort trades by time (oldest first)
  const sortedTrades = [...trades].sort((a, b) => a.time - b.time);

  // FIFO queue: [{ price, qty }, ...]
  const buyQueue: Array<{ price: number; qty: number }> = [];

  for (const trade of sortedTrades) {
    const price = parseFloat(trade.price);
    const qty = parseFloat(trade.qty);

    if (trade.buyer) {
      // Buy: add to queue
      buyQueue.push({ price, qty });
    } else {
      // Sell: remove from oldest buys (FIFO)
      let remainingToSell = qty;

      while (remainingToSell > 0 && buyQueue.length > 0) {
        const oldestBuy = buyQueue[0];

        if (oldestBuy.qty <= remainingToSell) {
          // Consume entire buy
          remainingToSell -= oldestBuy.qty;
          buyQueue.shift();
        } else {
          // Partial consume
          oldestBuy.qty -= remainingToSell;
          remainingToSell = 0;
        }
      }
    }
  }

  // Calculate average cost from remaining buys
  if (buyQueue.length === 0) {
    return { avgCost: 0, unrealizedPnl: 0, unrealizedPnlPercent: 0 };
  }

  const totalCost = buyQueue.reduce((sum, buy) => sum + (buy.price * buy.qty), 0);
  const totalQty = buyQueue.reduce((sum, buy) => sum + buy.qty, 0);
  const avgCost = totalCost / totalQty;

  // Calculate unrealized PnL
  const currentValue = currentHolding * currentPrice;
  const costBasis = currentHolding * avgCost;
  const unrealizedPnl = currentValue - costBasis;
  const unrealizedPnlPercent = (unrealizedPnl / costBasis) * 100;

  return { avgCost, unrealizedPnl, unrealizedPnlPercent };
}

/**
 * Fetch and build perp portfolio section
 * @param client - UniversalApiClient instance
 * @param limit - Max positions to show (undefined = show all)
 * @param style - Formatting style (default, style1, style2, style3)
 */
export async function fetchPerpData(client: UniversalApiClient, ctx: BotContext, limit?: number, style: 'default' | 'style1' | 'style2' | 'style3' = 'default'): Promise<{
  message: string;
  totalBalance: number;
  totalAvailable: number;
}> {
  const exchange = ctx.session.activeExchange || 'aster';
  const [accountRes, positionsRes] = await Promise.all([
    client.getAccount(exchange),
    // Wait, getAccount in UniversalApi returns specific structure.
    // In backend, getAccount returns payload with availableBalance etc.
    // getPositions returns array.
    client.getPositions(exchange),
  ]);

  if (!accountRes.success || !positionsRes.success) {
      throw new Error(accountRes.error || positionsRes.error || 'Failed to fetch perp data');
  }

  const futuresAccount = accountRes.data;
  const futuresPositions = positionsRes.data;

  // Get open futures positions (positionAmt != 0)
  interface Position {
    positionAmt: string;
    notional: string;
    symbol: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    leverage: string;
    liquidationPrice: string;
    marginType: string;
  }

  const openPositions = (futuresPositions as Position[])
    .filter((p) => parseFloat(p.positionAmt) !== 0)
    .sort((a, b) => Math.abs(parseFloat(b.notional)) - Math.abs(parseFloat(a.notional)));

  // Build perp section with style-specific separators
  let message = '';
  if (style === 'style1') {
    message = '━━━━━━━━━━━━━━━\n📊 <b>Perp Portfolio</b>\n\n';
  } else if (style === 'style2' || style === 'style3') {
    message = '📊 <b>Perp Portfolio</b>\n\n';
  } else {
    message = '📊 **Perp Portfolio:**\n';
  }

  const totalFuturesAvailable = parseFloat(futuresAccount.availableBalance) || 0;
  const totalFuturesMarginUsed = parseFloat(futuresAccount.totalPositionInitialMargin) || 0;
  const totalFuturesUnrealizedPnl = parseFloat(futuresAccount.totalUnrealizedProfit) || 0;

  // Balance = Available + Margin Used (what user actually has in perp account)
  const totalFuturesBalance = totalFuturesAvailable + totalFuturesMarginUsed;

  // Calculate PnL % based on wallet balance (avoid division by zero)
  const totalPerpPnlPercent = totalFuturesBalance > 0 ? (totalFuturesUnrealizedPnl / totalFuturesBalance) * 100 : 0;
  const perpPnlSign = totalFuturesUnrealizedPnl >= 0 ? '+' : '';
  const perpPnlPercentSign = totalPerpPnlPercent >= 0 ? '+' : '';

  // Format balance line based on style
  if (style === 'style1' || style === 'style2' || style === 'style3') {
    message += `Balance: <b>$${totalFuturesBalance.toFixed(2)}</b> | uPnL: <b>${perpPnlSign}$${totalFuturesUnrealizedPnl.toFixed(2)}</b> (${perpPnlPercentSign}${totalPerpPnlPercent.toFixed(2)}%)\n`;
    message += `Margin: <b>$${totalFuturesMarginUsed.toFixed(2)}</b>\n\n`;
  } else {
    message += `balance $${totalFuturesBalance.toFixed(2)} | uPnL: ${perpPnlSign}$${totalFuturesUnrealizedPnl.toFixed(2)} (${perpPnlPercentSign}${totalPerpPnlPercent.toFixed(2)}%)\n`;
    message += `Margin Used: $${totalFuturesMarginUsed.toFixed(2)}\n`;
  }

  if (openPositions.length > 0) {
    // Apply limit if provided, otherwise show all
    const positionsToShow = limit !== undefined ? openPositions.slice(0, limit) : openPositions;

    positionsToShow.forEach((p, index) => {
      const positionAmt = parseFloat(p.positionAmt);
      const entryPrice = parseFloat(p.entryPrice);
      const markPrice = parseFloat(p.markPrice);
      const unrealizedPnl = parseFloat(p.unRealizedProfit);
      const notional = Math.abs(parseFloat(p.notional));
      const leverage = parseFloat(p.leverage);
      const liquidationPrice = parseFloat(p.liquidationPrice);
      const marginType = p.marginType === 'isolated' ? 'Isolated' : 'Cross';

      // Calculate PnL %
      const initialMargin = notional / leverage;
      const pnlPercent = (unrealizedPnl / initialMargin) * 100;

      // Direction emoji
      const emoji = unrealizedPnl >= 0 ? '📈' : '📉';
      const pnlPercentSign = pnlPercent >= 0 ? '+' : '';
      const pnlUsdSign = unrealizedPnl >= 0 ? '+' : '';

      // Extract base asset from symbol (e.g., ASTERUSDT -> ASTER)
      const baseAsset = p.symbol.replace('USDT', '').replace('BUSD', '');

      // Format based on style
      if (style === 'style1') {
        message += formatPositionStyle1(p, index, initialMargin, pnlPercent, unrealizedPnl, leverage, marginType, baseAsset, notional, entryPrice, markPrice, liquidationPrice);
      } else if (style === 'style2') {
        message += formatPositionStyle2(p, index, initialMargin, pnlPercent, unrealizedPnl, leverage, marginType, baseAsset, notional, entryPrice, markPrice, liquidationPrice);
      } else if (style === 'style3') {
        message += formatPositionStyle3(p, index, initialMargin, pnlPercent, unrealizedPnl, leverage, marginType, baseAsset, notional, entryPrice, markPrice, liquidationPrice);
      } else {
        // Default format
        const emoji = unrealizedPnl >= 0 ? '📈' : '📉';
        const pnlPercentSign = pnlPercent >= 0 ? '+' : '';
        const pnlUsdSign = unrealizedPnl >= 0 ? '+' : '';
        message += `[/${p.symbol}](${getBotDeepLink(`position-${index}`)}) (${leverage.toFixed(0)}x ${marginType}) ${emoji} ${pnlPercentSign}${pnlPercent.toFixed(2)}% (${pnlUsdSign}$${unrealizedPnl.toFixed(2)}) | ${Math.abs(positionAmt)} ${baseAsset}/$${notional.toFixed(0)} | Margin $${initialMargin.toFixed(2)} | Entry $${entryPrice.toFixed(5)} | Mark $${markPrice.toFixed(5)} | Liq $${liquidationPrice.toFixed(5)}\n`;
      }
    });

    // Show "...and X more" only if we limited the display
    if (limit !== undefined && openPositions.length > limit) {
      message += `_...and ${openPositions.length - limit} more_\n`;
    }

    // Store positions in context for later retrieval
    ctx.session.tempPositions = positionsToShow.map((p) => p.symbol);
  } else {
    message += '_None_\n';
  }

  return {
    message,
    totalBalance: totalFuturesBalance,
    totalAvailable: totalFuturesAvailable,
  };
}

/**
 * Fetch and build spot portfolio section
 * @param limit - Max assets to show (undefined = show all)
 * @param style - Formatting style (default, style1, style2, style3)
 */
export async function fetchSpotData(client: UniversalApiClient, ctx: BotContext, limit?: number, style: 'default' | 'style1' | 'style2' | 'style3' = 'default'): Promise<{
  message: string;
  totalValue: number;
  usdtBalance: number;
}> {
  const exchange = ctx.session.activeExchange || 'aster';
  const [assetsRes] = await Promise.all([
    client.getAssets(exchange),
    // client.getUserTrades(), // Missing in UniversalApi? Yes. We might need to skip PnL for now or add getUserTrades.
    // For now, let's skip userTrades/PnL calculation to save time/complexity and focus on assets.
  ]);

  if (!assetsRes.success) {
      throw new Error(assetsRes.error || 'Failed to fetch spot data');
  }

  const spotAssetsData = assetsRes.data; // Should be array of assets

  // Get cached spot prices (refreshed every 10 mins)
  const spotPrices = getSpotPrices();

  // Get spot assets (free + locked > 0)
  interface SpotAsset {
    asset: string;
    total: number;
  }

  // Get spot assets (free + locked > 0)
  interface SpotAsset {
    asset: string;
    total: number;
  }

  const spotAssets: SpotAsset[] = spotAssetsData
    .filter((b: any) => parseFloat(b.free || '0') + parseFloat(b.locked || '0') > 0)
    .map((b: any) => ({
      asset: b.asset,
      total: parseFloat(b.free || '0') + parseFloat(b.locked || '0'),
    }))
    .sort((a: any, b: any) => b.total - a.total);

  // Calculate total USD value of all spot assets
  interface PriceTicker {
    symbol: string;
    lastPrice: string;
  }

  let totalSpotValue = 0;
  spotAssets.forEach(asset => {
    if (asset.asset === 'USDT') {
      totalSpotValue += asset.total;
    } else {
      const ticker = (spotPrices as PriceTicker[]).find((p) => p.symbol === `${asset.asset}USDT`);
      if (ticker) {
        const price = parseFloat(ticker.lastPrice);
        totalSpotValue += asset.total * price;
      }
    }
  });

  // Build spot section with style-specific separators
  let message = '';
  if (style === 'style1') {
    message = `━━━━━━━━━━━━━━━\n💼 <b>Spot Portfolio</b>\n\nBalance: <b>$${totalSpotValue.toFixed(2)}</b>\n\n`;
  } else if (style === 'style2' || style === 'style3') {
    message = `━━━━━━━━━━━━━━━\n💼 <b>Spot Portfolio</b>\nBalance: <b>$${totalSpotValue.toFixed(2)}</b>\n\n`;
  } else {
    message = '💼 **Spot Portfolio:**\n';
    message += `Balance: $${totalSpotValue.toFixed(2)}\n`;
  }

  if (spotAssets.length > 0) {
    // Apply limit if provided, otherwise show all
    const assetsToShow = limit !== undefined ? spotAssets.slice(0, limit) : spotAssets;
    assetsToShow.forEach((a, index) => {
      // Skip USDT (shown in balance above)
      if (a.asset === 'USDT') {
        return;
      }

      // Get current price
      const symbolName = `${a.asset}USDT`;
      const ticker = (spotPrices as PriceTicker[]).find((p) => p.symbol === symbolName);
      const currentPrice = ticker ? parseFloat(ticker.lastPrice) : 0;
      const usdValue = a.total * currentPrice;

      // Show USD value instead of user trades PnL (since not yet available)
      const valueDisplay = `$${usdValue.toFixed(2)}`;

      if (style === 'style1' || style === 'style2' || style === 'style3') {
        message += `<b>${symbolName}</b> ${a.total.toFixed(style === 'style2' || style === 'style3' ? 4 : 8)} ${a.asset} (${valueDisplay})\n`;
      } else {
        message += `[/${symbolName}](${getBotDeepLink(`spot-${index}`)}) ${a.total.toFixed(8)} ${a.asset} | ${valueDisplay}\n`;
      }
    });

    // Show "...and X more" only if we limited the display
    if (limit !== undefined && spotAssets.length > limit) {
      message += `_...and ${spotAssets.length - limit} more_\n`;
    }

    // Store assets in context for later retrieval (exclude USDT)
    ctx.session.tempSpotAssets = assetsToShow.filter(a => a.asset !== 'USDT').map(a => a.asset);
  } else {
    message += '_No assets_\n';
  }

  const spotUsdtBalance = spotAssets.find(a => a.asset === 'USDT')?.total || 0;

  return {
    message,
    totalValue: totalSpotValue,
    usdtBalance: spotUsdtBalance,
  };
}

/**
 * Show account overview with balance and positions (Command Citadel)
 */
export async function showOverview(ctx: BotContext, editMessage = false, style: 'default' | 'style1' | 'style2' | 'style3' = 'default'): Promise<void> {
  const userId = ctx.session.userId;

  if (!userId) {
    const errorMsg = '❌ Session error. Please use /link to connect your account.';
    if (editMessage && ctx.callbackQuery?.message) {
      await ctx.editMessageText(errorMsg);
    } else {
      await ctx.reply(errorMsg);
    }
    return;
  }

  // Show loading message first
  let messageToEdit;
  if (editMessage && ctx.callbackQuery?.message) {
    await ctx.editMessageText(
      '👋 **Welcome back!**\n\n⏳ Loading your assets & positions...',
      { parse_mode: 'Markdown' }
    );
    messageToEdit = ctx.callbackQuery.message;
  } else {
    messageToEdit = await ctx.reply(
      '👋 **Welcome back!**\n\n⏳ Loading your assets & positions...',
      { parse_mode: 'Markdown' }
    );
  }

  // Clean up old button messages EXCEPT this one
  await cleanupButtonMessages(ctx, messageToEdit.message_id);

  try {
    const redis = getRedis();
    const db = getPostgres();
    // Initialize Universal Client
    const client = new UniversalApiClient();
    const isSessionInit = await client.initSession(userId);
    
    if (!isSessionInit) {
        throw new Error('Failed to initialize session');
    }

    // Track which sections have loaded
    // Track which sections have loaded with explicit types
    interface PerpData { message: string; totalBalance: number; totalAvailable: number }
    interface SpotData { message: string; totalValue: number; usdtBalance: number }
    
    let perpData: PerpData | null = null;
    let spotData: SpotData | null = null;
    let perpError: string | null = null;
    let spotError: string | null = null;

    // Debug client
    console.log('[Overview] Client methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

    // Fetch perp and spot data in parallel, update as each resolves
    const perpPromise = fetchPerpData(client, ctx, 10, style) // Limit to 10 for overview
      .then(data => {
        perpData = data;
        return data;
      })
      .catch(error => {
        console.error('[Overview] Perp fetch error:', error.message); // Log message only to reduce noise
        if (error.message.includes('No credentials')) {
             perpError = 'Credentials missing. Please /link.';
        } else {
             perpError = 'Failed to load perp data';
        }
        return null; // Don't throw, just return null so Promise.all (or race) continues
      });

    const spotPromise = fetchSpotData(client, ctx, 10, style) // Limit to 10 for overview
      .then(data => {
        spotData = data;
        return data;
      })
      .catch(error => {
        console.error('[Overview] Spot fetch error:', error);
        spotError = 'Failed to load spot data';
        return null;
      });

    // Wait for the first one to complete and update UI
    // Use Promise.allSettled pattern via catching above so we don't crash
    // Actually we are using .then().catch() so result is a resolved promise of null or data.
    // So Promise.race works fine.
    await Promise.race([perpPromise, spotPromise]);

    // Build initial message with whichever section loaded first
    let message = style === 'default' ? '🏦 **Command Citadel**\n\n' : `🏦 <b>Command Citadel</b> (Style ${style.replace('style', '')})\n\n`;

    if (perpData) {
      message += (perpData as any).message + '\n';
    } else if (perpError) {
      message += `📊 **Perp Portfolio:** ⚠️ ${perpError}\n\n`;
    } else {
      message += `📊 **Perp Portfolio:** ⏳ Loading...\n\n`;
    }

    if (spotData) {
      message += (spotData as any).message + '\n';
    } else if (spotError) {
      message += `💼 **Spot Portfolio:** ⚠️ ${spotError}\n\n`;
    } else {
      message += `💼 **Spot Portfolio:** ⏳ Loading...\n\n`;
    }

    // Update message with first section loaded
    await ctx.telegram.editMessageText(
      messageToEdit.chat.id,
      messageToEdit.message_id,
      undefined,
      message,
      { parse_mode: style === 'default' ? 'Markdown' : 'HTML' }
    );

    // Wait for both to complete
    await Promise.all([perpPromise, spotPromise]);

    // Build final message with both sections
    message = style === 'default' ? '🏦 **Command Citadel**\n\n' : `🏦 <b>Command Citadel</b> (Style ${style.replace('style', '')})\n\n`;

    // Add perp section
    if (perpData) {
      message += (perpData as any).message + '\n';
    } else if (perpError) {
      message += `📊 **Perp Portfolio:** ⚠️ ${perpError}\n\n`;
    }

    // Add spot section
    if (spotData) {
      message += (spotData as any).message + '\n';
    } else if (spotError) {
      message += `💼 **Spot Portfolio:** ⚠️ ${spotError}\n\n`;
    }

    // Add summary (only if we have data from at least one section)
    if (perpData || spotData) {
      const totalFuturesBalance = (perpData as any)?.totalBalance || 0;
      const totalFuturesAvailable = (perpData as any)?.totalAvailable || 0;
      const totalSpotValue = (spotData as any)?.totalValue || 0;
      const spotUsdtBalance = (spotData as any)?.usdtBalance || 0;
      const totalWalletValue = totalSpotValue + totalFuturesBalance;

      if (style === 'style1' || style === 'style2' || style === 'style3') {
        message += `━━━━━━━━━━━━━━━\n`;
        message += `Spot <b>$${spotUsdtBalance.toFixed(2)}</b> | Perp <b>$${totalFuturesAvailable.toFixed(2)}</b>\nTotal <b>$${totalWalletValue.toFixed(2)}</b>`;
      } else {
        message += `Spot available $${spotUsdtBalance.toFixed(2)} USDT | Perp available $${totalFuturesAvailable.toFixed(2)} Margin\n\n`;
        message += `Account Balance: $${totalWalletValue.toFixed(2)}`;
      }
    }

    // Add main menu buttons
    const buttons = [
      [
        Markup.button.callback('📊 All Assets', 'balance'),
        Markup.button.callback('📈 All Perps', 'positions'),
      ],
      [
        Markup.button.callback('💰 Trade', 'trade'),
        Markup.button.callback('🔄 Refresh', 'refresh_overview'),
      ],
      [
        Markup.button.callback('⚙️ Settings', 'settings'),
        Markup.button.callback('❓ Help', 'help'),
      ]
    ];

    // Update message with final data and menu buttons
    await ctx.telegram.editMessageText(
      messageToEdit.chat.id,
      messageToEdit.message_id,
      undefined,
      message,
      {
        parse_mode: style === 'default' ? 'Markdown' : 'HTML',
        ...Markup.inlineKeyboard(buttons),
      }
    );

    // Store overview message ID in session for deep link editing
    ctx.session.overviewMessageId = messageToEdit.message_id;

    // Note: Message is already tracked by cleanupButtonMessages() call above
  } catch (error: any) {
    console.error('[Overview] Error:', error);

    let errorMessage = '❌ **Failed to Load Overview**\n\n';
    errorMessage += error.message || 'Unexpected error occurred.';
    errorMessage += '\n\nUse /menu to try again.';

    await ctx.telegram.editMessageText(
      messageToEdit.chat.id,
      messageToEdit.message_id,
      undefined,
      errorMessage,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Retry', 'menu')],
          [Markup.button.callback('❓ Help', 'help')],
        ]),
      }
    );
  }
}

/**
 * Refresh overview action
 */
overviewMenuComposer.action('refresh_overview', async (ctx) => {
  await ctx.answerCbQuery('🔄 Refreshing...');
  await showOverview(ctx, true);
});
