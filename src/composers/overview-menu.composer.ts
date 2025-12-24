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
import { getLinkedExchanges } from '../db/users';
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
export async function fetchPerpData(
  client: UniversalApiClient, 
  ctx: BotContext, 
  limit?: number, 
  style: 'default' | 'style1' | 'style2' | 'style3' = 'default',
  exchangeOverride?: string
): Promise<{
  message: string;
  totalBalance: number;
  totalAvailable: number;
}> {
  const exchange = exchangeOverride || ctx.session.activeExchange || 'aster';
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
export async function fetchSpotData(
  client: UniversalApiClient, 
  ctx: BotContext, 
  limit?: number, 
  style: 'default' | 'style1' | 'style2' | 'style3' = 'default',
  exchangeOverride?: string
): Promise<{
  message: string;
  totalValue: number;
  usdtBalance: number;
}> {
  const exchange = exchangeOverride || ctx.session.activeExchange || 'aster';
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
    
    // Check if user has any linked exchanges FIRST
    const linkedExchanges = await getLinkedExchanges(userId);
    
    if (linkedExchanges.length === 0) {
      // User has no exchanges linked - show welcome screen
      const welcomeMessage = `🏦 **Command Citadel**\n\n` +
        `👋 Welcome! You haven't linked any exchange yet.\n\n` +
        `🔗 **Link an exchange to get started:**\n\n` +
        `• ⭐ **Aster DEX** - Fast & secure trading\n` +
        `• 🟢 **Hyperliquid** - Advanced perpetuals\n\n` +
        `_Click a button below to connect your account._`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⭐ Link Aster DEX', 'link_aster')],
        [Markup.button.callback('🟢 Link Hyperliquid', 'link_hyperliquid')],
        [Markup.button.callback('🔍 Search Symbols', 'search_prompt')],
      ]);
      
      if (editMessage && ctx.callbackQuery?.message) {
        await ctx.editMessageText(welcomeMessage, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
      } else {
        const msg = await ctx.reply(welcomeMessage, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
        trackButtonMessage(ctx, msg.message_id);
      }
      return;
    }
    
    // User has exchanges - proceed with session and data fetch
    const client = new UniversalApiClient();
    const isSessionInit = await client.initSession(userId);
    
    if (!isSessionInit) {
        throw new Error('Failed to initialize session');
    }

    // If no exchanges linked (shouldn't happen now, but fallback to aster)
    const exchangesToFetch = linkedExchanges.length > 0 ? linkedExchanges : ['aster'];
    
    console.log(`[Overview] Fetching data for: ${exchangesToFetch.join(', ')}`);

    let message = style === 'default' ? '🏦 **Command Citadel**\n\n' : `🏦 <b>Command Citadel</b> (Style ${style.replace('style', '')})\n\n`;
    let globalTotalBalance = 0;
    
    // Process each exchange
    for (const exchange of exchangesToFetch) {
        // Exchange Header
        const exchangeName = exchange.charAt(0).toUpperCase() + exchange.slice(1); // Capitalize
        
        if (style === 'default') {
             message += `**#${exchangeName} Exchange**\n`; 
        } else {
             message += `<b>#${exchangeName} Exchange</b>\n`;
        }
        
        let perpData: { message: string; totalBalance: number; totalAvailable: number } | null = null;
        let spotData: { message: string; totalValue: number; usdtBalance: number } | null = null;
        let perpError: string | null = null;
        let spotError: string | null = null;

        try {
            // Fetch concurrently for this exchange
            const [perpResult, spotResult] = await Promise.allSettled([
                fetchPerpData(client, ctx, 10, style, exchange),
                fetchSpotData(client, ctx, 10, style, exchange)
            ]);

            // Handle Perp Result
            if (perpResult.status === 'fulfilled') {
                perpData = perpResult.value;
                globalTotalBalance += perpResult.value.totalBalance;
            } else {
                console.error(`[Overview] ${exchange} perp error:`, perpResult.reason);
                if (perpResult.reason?.message?.includes('No credentials')) {
                    perpError = 'Credentials missing.';
                } else {
                    perpError = 'Failed to load.';
                }
            }

            // Handle Spot Result
            if (spotResult.status === 'fulfilled') {
                 spotData = spotResult.value;
                 globalTotalBalance += spotResult.value.totalValue;
            } else {
                 console.error(`[Overview] ${exchange} spot error:`, spotResult.reason);
                 spotError = 'Failed to load.';
            }

        } catch (err) {
            console.error(`[Overview] Error fetching ${exchange}:`, err);
        }

        // Add to message
        if (perpData) {
            message += (perpData as any).message;
        } else if (perpError) {
            message += `📊 **Perp Portfolio:** ⚠️ ${perpError}\n\n`;
        }

        if (spotData) {
            message += (spotData as any).message;
        } else if (spotError) {
             message += `💼 **Spot Portfolio:** ⚠️ ${spotError}\n\n`;
        }
        
        // Summary Line for this Exchange
        const spotAvailable = spotData ? spotData.usdtBalance : 0;
        const perpAvailable = perpData ? perpData.totalAvailable : 0;
        const exchangeTotal = (perpData ? perpData.totalBalance : 0) + (spotData ? spotData.totalValue : 0);
        
        message += `Spot available $${spotAvailable.toFixed(2)} USDT | Perp available $${perpAvailable.toFixed(2)} Margin\n\n`;
        message += `Account Balance: $${exchangeTotal.toFixed(2)}\n\n`;

        if (!perpData && !spotData && !perpError && !spotError) {
             message += `(No data available)\n\n`;
        }
    }
    
    // Global Total Balance
    if (style === 'default') {
        message += `💰 **Total Account Balance:** $${globalTotalBalance.toFixed(2)}\n`;
    } else {
        message += `💰 <b>Total Account Balance:</b> $${globalTotalBalance.toFixed(2)}\n`;
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

    // Store overview message ID in session
    ctx.session.overviewMessageId = messageToEdit.message_id;

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
