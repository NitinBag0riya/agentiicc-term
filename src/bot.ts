/**
 * Main bot setup - Functional style
 */
import { UniversalApiClient } from './services/universalApi';
import { Telegraf, Scenes, Markup } from 'telegraf';
import { BotContext } from './types/context';
import { createSessionMiddleware } from './middleware/session';
import { createReferralMiddleware } from './middleware/referral';
import { linkScene } from './scenes/link.scene';
import { unlinkScene } from './scenes/unlink.scene';
import { marketOrderScene, limitOrderScene } from './scenes/trade.scene';
import { leverageWizard } from './scenes/leverage.scene';
import { marginWizard } from './scenes/margin.scene';
import { spotBuyWizard } from './scenes/spot-buy-wizard.scene';
import { spotSellWizard } from './scenes/spot-sell-wizard.scene';
import { spotAssetsComposer } from './composers/spot-assets';
import { futuresPositionsComposer, showPositionManagement } from './composers/futures-positions';
import { overviewMenuComposer, showOverview, cleanupButtonMessages, trackButtonMessage } from './composers/overview-menu.composer';
import { removeButtonsFromCallback } from './utils/countdown';
import {
  getSpotTradingSymbols,
  getFuturesTradingSymbols,
  getSpotSymbol,
  getFuturesSymbol,
} from './services/exchangeInfo.service';
import { handleConfirm, handleCancel, handleRecalc } from './utils/confirmDialog';
import { getRedis } from './db/redis';
import { getPostgres } from './db/postgres';
import { getBotDeepLink } from './utils/botInfo';
import { normalizeSymbol } from './utils/inputParser';
import type { AsterWriteOp } from './services/ops/types';

/**
 * Create bot instance
 */
export function createBot(token: string): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);

  console.log('[Bot] Creating bot...');

  // Middleware: Session (Redis)
  bot.use(createSessionMiddleware());

  // Middleware: Referral enforcement (must come after session)
  bot.use(createReferralMiddleware());

  // Middleware: Scene manager
  const stage = new Scenes.Stage<BotContext>([
    linkScene,
    unlinkScene,
    marketOrderScene,
    limitOrderScene,
    leverageWizard,
    marginWizard,
    spotBuyWizard,
    spotSellWizard,
  ] as any);
  bot.use(stage.middleware());

  // Composers
  bot.use(spotAssetsComposer);
  bot.use(futuresPositionsComposer);
  bot.use(overviewMenuComposer);

  // Error handling
  bot.catch((err, ctx) => {
    console.error('[Bot] Error:', err);
    ctx.reply('❌ An error occurred. Please try again.');
  });

  console.log('[Bot] ✅ Bot created');

  return bot;
}

/**
 * Common welcome message for unlinked users
 */
const WELCOME_MESSAGE_UNLINKED =
  '👋 **Welcome to StableSolid**\n' +
  '_Your Easy Terminal into Trading on Aster Dex_\n\n' +
  '**Choose How to Connect:**\n\n' +
  '🔐 **WalletConnect (Recommended)** - One-click wallet connection\n' +
  '🔗 **API Key** - Manual setup from Aster DEX\n\n' +
  '🔒 _Your credentials are encrypted and stored securely_\n\n' +
  '**Available Commands:**\n' +
  '/menu - Open main menu\n' +
  '/help - Get help';

/**
 * Generate inline keyboard for unlinked users
 */
function getUnlinkedKeyboard() {
  let url = process.env.MINI_APP_URL;

  // Fallback to local hosting if WEBHOOK_URL is available
  if (!url && process.env.WEBHOOK_URL) {
    url = `${process.env.WEBHOOK_URL}/mini-app`;
  }

  if (!url) {
    url = 'https://t.me/My_Test_Tradeee_bot/app'; // Default placeholder
  }

  return Markup.inlineKeyboard([
    [Markup.button.webApp('🔐 Sign in via WalletConnect', url)],
    [Markup.button.callback('🔗 Link via API Key', 'start_link')],
    [Markup.button.callback('❓ Help', 'help')],
  ]);
}

/**
 * Show the appropriate menu based on login status
 */
export async function showMenu(ctx: BotContext) {
  if (ctx.session.isLinked) {
    await showOverview(ctx);
  } else {
    await ctx.reply(WELCOME_MESSAGE_UNLINKED, {
      parse_mode: 'Markdown',
      ...getUnlinkedKeyboard(),
    });
  }
}

/**
 * Generate help message based on login status
 */
function getHelpMessage(isLinked: boolean): string {
  const botFeatures =
    '📚 **StableSolid Trading Bot Help**\n\n' +
    '**🎯 Features:**\n\n' +
    '**Trading:**\n' +
    '• Market & Limit Orders\n' +
    '• Take Profit & Stop Loss (TP/SL)\n' +
    '• Spot & Futures Trading\n\n' +
    '**Search:**\n' +
    '• Type any symbol name and hit enter\n' +
    '• Instantly view prices and open positions\n' +
    '• Quick access to buy/sell\n\n' +
    '**Position Management:**\n' +
    '• Set leverage (1x-125x) per symbol\n' +
    '• Toggle Isolated/Cross margin per symbol\n' +
    '• Add/reduce isolated margin\n' +
    '• Close positions (full or partial)\n\n' +
    '**Account Settings:**\n' +
    '• Multi-Asset Mode: Use multiple assets as margin\n' +
    '• Single-Asset Mode: Use only USDT as margin\n\n' +
    '**📖 Important Notes:**\n\n' +
    '**Margin Types:**\n' +
    '• **Cross Margin:** Uses full account balance as margin\n' +
    '• **Isolated Margin:** Limits risk to position-specific margin\n\n' +
    '**Isolated Margin Requirements:**\n' +
    '⚠️ To use Isolated margin:\n' +
    '1. Account must be in Single-Asset Mode\n' +
    '2. Set via /menu → Settings → Asset Mode\n\n' +
    '⚠️ To switch back to Multi-Asset Mode:\n' +
    '1. All symbols must be set to Cross margin\n' +
    '2. Required even with no open orders/positions\n' +
    '3. This is an Aster DEX restriction\n\n' +
    '**Per-Symbol Settings:**\n' +
    '• Each symbol has its own leverage setting\n' +
    '• Each symbol has its own margin type (Cross/Isolated)\n' +
    '• Settings persist until you change them\n\n' +
    '**📚 Learn More:**\n' +
    '[Aster DEX Documentation](https://docs.asterdex.com/)\n' +
    '[Leverage & Margin Guide](https://www.asterdex.com/en/futures/trading-rules/leverage-and-margin)\n' +
    '[Margin Trading Guide](https://docs.asterdex.com/astherusex-orderbook-perp-guide/margin)\n' +
    '[Hedge Mode Guide](https://docs.asterdex.com/product/aster-perpetual-pro/hedge-mode)\n\n';

  if (isLinked) {
    // LOGGED IN: Bot features at top, login instructions at bottom
    return (
      botFeatures +
      '**🔧 Commands:**\n' +
      '/menu - Open main menu\n' +
      '/help - Show this help\n\n' +
      '**🔗 Account Management:**\n' +
      'To unlink your API: /menu → Settings → Unlink API'
    );
  } else {
    // NOT LOGGED IN: Login instructions at top, bot features below
    return (
      '📚 **StableSolid Trading Bot Help**\n\n' +
      '**🔗 Getting Started (Choose One):**\n\n' +
      '**Option 1: WalletConnect (Recommended)**\n' +
      '1️⃣ Use /menu and click "Sign in via WalletConnect"\n' +
      '2️⃣ Connect your wallet (MetaMask, Trust Wallet, etc.)\n' +
      '3️⃣ Sign the message to create your API keys\n\n' +
      '**Option 2: Manual API Key**\n' +
      '1️⃣ Visit [Aster DEX API Management](https://www.asterdex.com/en/api-management)\n' +
      '2️⃣ Create API Key & Secret with trading permissions\n' +
      '3️⃣ Use /menu and click "Link via API Key"\n\n' +
      '🔒 Your credentials are encrypted and stored securely\n\n' +
      botFeatures +
      '**🔧 Commands:**\n' +
      '/menu - Open main menu\n' +
      '/help - Show this help'
    );
  }
}

/**
 * Setup bot commands and handlers
 */
export function setupBot(bot: Telegraf<BotContext>): void {
  console.log('[Bot] Setting up commands...');

  // ==================== /start Command ====================
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from.id;
    const username = ctx.from.username || null;
    const db = getPostgres();

    // Check if there's a payload (could be referral code or deep link)
    const payload = ctx.message.text.split(' ')[1];

    // If user is not verified, check for referral code
    const { needsReferralCode, createUserWithReferral, validateReferralCode, getUserReferralCode, createSeedUser } = await import('./db/referrals');
    const needsRef = await needsReferralCode(db, telegramId);

    if (needsRef) {
      // User needs referral code
      if (!payload) {
        // No payload - show referral code requirement message
        await ctx.reply(
          '🔒 **Welcome to StableSolid!**\n\n' +
          'This bot requires a **referral code** to access.\n\n' +
          '**How to get started:**\n' +
          '1️⃣ Get a referral code from an existing user\n' +
          '2️⃣ Send `/start YOUR_CODE` to activate access\n\n' +
          '💡 Example: `/start ABC12XYZ`\n\n' +
          '_Don\'t have a code? Ask a friend who uses this bot!_',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❓ Help', 'help')],
            ]),
          }
        );
        return;
      }

      // Has payload - validate as referral code
      const validation = await validateReferralCode(db, payload);

      if (!validation.valid) {
        await ctx.reply(
          '❌ **Invalid Referral Code**\n\n' +
          `The code \`${payload}\` is not valid.\n\n` +
          '**Please check:**\n' +
          '• Code is typed correctly (case-insensitive)\n' +
          '• Code is from an active user\n\n' +
          'Try again with: `/start VALID_CODE`',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('❓ Help', 'help')],
            ]),
          }
        );
        return;
      }

      // Valid referral code - create user
      const result = await createUserWithReferral(db, telegramId, username, payload);

      if (!result) {
        await ctx.reply('❌ Error creating account. Please try again.');
        return;
      }

      const { getOrCreateUser } = await import('./db/users');
      const user = await getOrCreateUser(telegramId, username || undefined);

      // Update session
      ctx.session.userId = user.id;
      ctx.session.telegramId = telegramId;
      ctx.session.username = username || undefined;

      // Show success message with their own referral code
      await ctx.reply(
        '✅ **Welcome to StableSolid!**\n\n' +
        `You've successfully joined using ${validation.referrerUsername}'s referral code!\n\n` +
        `🎁 **Your Referral Code:** \`${result.ownReferralCode}\`\n\n` +
        'Share your code to invite friends and earn rewards!\n\n' +
        '**Next Steps:**\n' +
        '1️⃣ Link your trading account (/menu)\n' +
        '2️⃣ Start trading on Aster DEX\n' +
        '3️⃣ Share your referral code with friends',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Get Started', 'menu')],
            [Markup.button.callback('📊 My Referrals', 'referrals')],
          ]),
        }
      );
      return;
    }

    // User is verified - handle normal /start flow
    const isLinked = ctx.session.isLinked;

    if (payload && isLinked) {
      // Delete the /start command message
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.log('[Start] Could not delete /start message:', error);
      }

      // Handle deep link actions
      if (payload.startsWith('spot-')) {
        const index = parseInt(payload.split('-')[1]);
        const assets = ctx.session.tempSpotAssets || [];
        const asset = assets[index];

        if (asset && ctx.session.overviewMessageId) {
          // Edit only the buttons, keep the overview message content
          await ctx.telegram.editMessageReplyMarkup(
            ctx.chat!.id,
            ctx.session.overviewMessageId,
            undefined,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(`📈 Buy ${asset}`, `spot_buy:${asset}`),
                Markup.button.callback(`📉 Sell ${asset}`, `spot_sell:${asset}`),
              ],
              [Markup.button.callback('« Back', 'menu')],
            ]).reply_markup
          );
          return;
        }
      }

      if (payload.startsWith('position-iso-')) {
        const index = parseInt(payload.split('-')[2]);
        const positions = ctx.session.tempIsolatedPositions || [];
        const symbol = positions[index];

        if (symbol) {
          // Delete the /start command message
          try {
            await ctx.deleteMessage();
          } catch (error) {
            console.log('[Start] Could not delete /start message:', error);
          }

          // Show position management interface (new message)
          await showPositionManagement(ctx, symbol);
          return;
        }
      }

      if (payload.startsWith('position-')) {
        const index = parseInt(payload.split('-')[1]);
        const positions = ctx.session.tempPositions || [];
        const symbol = positions[index];

        if (symbol) {
          // Show position management interface (new message)
          await showPositionManagement(ctx, symbol);
          return;
        }
      }

      if (payload.startsWith('symbol-')) {
        // Delete the /start command message
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.log('[Start] Could not delete /start message:', error);
        }

        const index = parseInt(payload.split('-')[1]);
        const results = ctx.session.searchResults || [];
        const result = results[index];

        if (result && result.type === 'futures') {
          // For futures, check if user has an open position and show position management
          await showPositionManagement(ctx, result.symbol);
          return;
        }

        if (result && result.type === 'spot') {
          // Get symbol info
          const symbolInfo = getSpotSymbol(result.symbol);

          if (!symbolInfo) {
            await ctx.reply('❌ Symbol information not available');
            return;
          }

          // Build details message
          let detailsMessage = `💱 **${result.symbol}**\n\n`;
          detailsMessage += `**Market:** Spot\n`;
          detailsMessage += `**Base Asset:** ${symbolInfo.baseAsset}\n`;
          detailsMessage += `**Quote Asset:** ${symbolInfo.quoteAsset}\n`;
          detailsMessage += `**Status:** ${symbolInfo.status}\n\n`;

          // Define filter types
          interface SymbolFilter {
            filterType: string;
            tickSize?: string;
            minPrice?: string;
            maxPrice?: string;
            stepSize?: string;
            minQty?: string;
            maxQty?: string;
            minNotional?: string;
            notional?: string;
          }

          const filters = symbolInfo.filters as SymbolFilter[];

          // Price Filter
          const priceFilter = filters.find((f) => f.filterType === 'PRICE_FILTER');
          if (priceFilter) {
            detailsMessage += `📊 **Price Info:**\n`;
            detailsMessage += `• Tick Size: ${priceFilter.tickSize}\n`;
            detailsMessage += `• Min Price: ${priceFilter.minPrice}\n`;
            detailsMessage += `• Max Price: ${priceFilter.maxPrice}\n\n`;
          }

          // Lot Size Filter (regular orders)
          const lotSizeFilter = filters.find((f) => f.filterType === 'LOT_SIZE');
          if (lotSizeFilter) {
            detailsMessage += `📦 **Quantity Limits:**\n`;
            detailsMessage += `• Step Size: ${lotSizeFilter.stepSize}\n`;
            detailsMessage += `• Min Qty: ${lotSizeFilter.minQty}\n`;
            detailsMessage += `• Max Qty: ${lotSizeFilter.maxQty}\n\n`;
          }

          // Market Lot Size Filter (market orders)
          const marketLotSizeFilter = filters.find((f) => f.filterType === 'MARKET_LOT_SIZE');
          if (marketLotSizeFilter) {
            detailsMessage += `⚡ **Market Order Limits:**\n`;
            detailsMessage += `• Min Qty: ${marketLotSizeFilter.minQty}\n`;
            detailsMessage += `• Max Qty: ${marketLotSizeFilter.maxQty}\n\n`;
          }

          // Min Notional Filter
          const minNotionalFilter = filters.find((f) =>
            f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL'
          );
          if (minNotionalFilter) {
            const minNotional = minNotionalFilter.minNotional || minNotionalFilter.notional;
            if (minNotional) {
              detailsMessage += `💰 **Min Order Value:** $${minNotional}\n\n`;
            }
          }

          detailsMessage += `_What would you like to do?_`;

          await ctx.reply(detailsMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(`📈 Buy ${result.symbol}`, `spot_buy:${result.symbol}`),
                Markup.button.callback(`📉 Sell ${result.symbol}`, `spot_sell:${result.symbol}`),
              ],
              [Markup.button.callback('« Back to Menu', 'menu')],
            ]),
          });
          return;
        }
      }
    }

    if (!isLinked) {
      // NOT LINKED: Show welcome message with API setup instructions
      await ctx.reply(WELCOME_MESSAGE_UNLINKED, {
        parse_mode: 'Markdown',
        ...getUnlinkedKeyboard(),
      });
    } else {
      // LINKED: Show overview with balance + positions
      await showOverview(ctx);
    }
  });

  // ==================== /menu Command ====================
  bot.command('menu', async (ctx) => {
    try {
      // Clear any waiting input state (highest priority reset)
      ctx.session.waitingForInput = undefined;
      await showMenu(ctx);
    } catch (error) {
      console.error('[Menu Command] Error:', error);
      // Still clear waiting state even on error
      ctx.session.waitingForInput = undefined;
      await ctx.reply('❌ Error loading menu. Please try again.');
    }
  });

  // ==================== TEMPORARY: /menu1, /menu2, /menu3 for testing ====================
  bot.command('menu1', async (ctx) => {
    if (ctx.session.isLinked) {
      await showOverview(ctx, false, 'style1');
    } else {
      await ctx.reply('Please /link first');
    }
  });

  bot.command('menu2', async (ctx) => {
    if (ctx.session.isLinked) {
      await showOverview(ctx, false, 'style2');
    } else {
      await ctx.reply('Please /link first');
    }
  });

  bot.command('menu3', async (ctx) => {
    if (ctx.session.isLinked) {
      await showOverview(ctx, false, 'style3');
    } else {
      await ctx.reply('Please /link first');
    }
  });

  // ==================== /link Command ====================
  bot.command('link', (ctx) => ctx.scene.enter('link'));

  // ==================== /unlink Command ====================
  bot.command('unlink', (ctx) => ctx.scene.enter('unlink'));

  // ==================== /help Command ====================
  bot.command('help', async (ctx) => {
    const isLinked = !!ctx.session.isLinked;
    const helpMessage = getHelpMessage(isLinked);

    await ctx.reply(helpMessage, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  });

  // ==================== Button Handlers ====================

  // Start link flow
  bot.action('start_link', async (ctx) => {
    await ctx.answerCbQuery();
    await removeButtonsFromCallback(ctx);
    return ctx.scene.enter('link');
  });

  // Help
  bot.action('help', async (ctx) => {
    await ctx.answerCbQuery();
    const isLinked = !!ctx.session.isLinked;
    const helpMessage = getHelpMessage(isLinked);

    await ctx.editMessageText(
      helpMessage,
      {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
        ...Markup.inlineKeyboard([
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Main menu - Send fresh /menu
  bot.action('menu', async (ctx) => {
    try {
      await ctx.answerCbQuery();

      // Clear any waiting input state (highest priority reset)
      ctx.session.waitingForInput = undefined;

      // Clean up old button messages
      await cleanupButtonMessages(ctx);

      const isLinked = ctx.session.isLinked;

      if (!isLinked) {
        const sentMessage = await ctx.reply(WELCOME_MESSAGE_UNLINKED, {
          parse_mode: 'Markdown',
          ...getUnlinkedKeyboard(),
        });
        trackButtonMessage(ctx, sentMessage.message_id);
      } else {
        // Send fresh menu overview
        await showOverview(ctx, false); // editMessage = false
      }
    } catch (error) {
      console.error('[Menu Action] Error:', error);
      // Still clear waiting state even on error
      ctx.session.waitingForInput = undefined;
      await ctx.answerCbQuery('Error loading menu');
    }
  });

  // Placeholder handlers (TODO: implement these)
  bot.action('trade', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('💰 Trade feature coming soon!');
  });

  // Refresh overview action
  bot.action('refresh_overview', async (ctx) => {
    await ctx.answerCbQuery('🔄 Refreshing...');
    await showOverview(ctx, true);
  });

  bot.action('settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚙️ **Settings**\n\n' +
      'Manage your account and preferences.',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💰 Asset Mode', 'settings_asset_mode')],
          [Markup.button.callback('👤 Profile', 'settings_profile')],
          [Markup.button.callback('🔓 Unlink My Creds', 'settings_unlink')],
          [Markup.button.callback('🗑️ Perm Delete My Acc', 'settings_delete')],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Settings submenu handlers
  bot.action('settings_asset_mode', async (ctx) => {
    await ctx.answerCbQuery('🔄 Loading...');

    if (!ctx.session.userId || !ctx.session.isLinked) {
      await ctx.editMessageText('❌ You need to link your API first.', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'settings')]]),
      });
      return;
    }

    try {
      const db = getPostgres();
      const redis = getRedis();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);
      const assetModeRes = await client.getMultiAssetsMargin();
      
      if (!assetModeRes.success) throw new Error(assetModeRes.error);
      const assetMode = assetModeRes.data;

      const isMultiAsset = assetMode.multiAssetsMargin;
      const currentMode = isMultiAsset ? 'Multi-Asset Mode' : 'Single-Asset Mode';
      const newMode = isMultiAsset ? 'Single-Asset Mode' : 'Multi-Asset Mode';

      let message = `💰 **Asset Mode Settings**\n\n`;
      message += `**Current Mode:** ${currentMode}\n\n`;

      if (isMultiAsset) {
        message += `📊 **Multi-Asset Mode**\n`;
        message += `• Use multiple assets as margin\n`;
        message += `• More flexible\n`;
        message += `• Cannot use isolated margin\n\n`;
        message += `💡 **Switch to Single-Asset?**\n`;
        message += `• Required for isolated margin\n`;
        message += `• Use only USDT as margin\n`;
      } else {
        message += `💵 **Single-Asset Mode**\n`;
        message += `• Use only USDT as margin\n`;
        message += `• Required for isolated margin\n`;
        message += `• Simpler risk management\n\n`;
        message += `💡 **Switch to Multi-Asset?**\n`;
        message += `• Use multiple assets as margin\n`;
        message += `• More flexibility\n`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`🔄 Switch to ${newMode}`, 'settings_asset_mode_toggle')],
          [Markup.button.callback('« Back', 'settings')],
        ]),
      });
    } catch (error) {
      console.error('[Asset Mode Settings] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await ctx.editMessageText(
        `❌ Failed to load asset mode settings.\n\n` +
        `Error: ${errorMessage}\n\n` +
        `Please try again or contact support if the issue persists.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('« Back', 'settings')]]),
        }
      );
    }
  });

  bot.action('settings_asset_mode_toggle', async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.session.userId || !ctx.session.isLinked) return;

    try {
      const db = getPostgres();
      const redis = getRedis();
      const client = new UniversalApiClient();
      await client.initSession(ctx.session.userId);
      const assetModeRes = await client.getMultiAssetsMargin();
      
      if (!assetModeRes.success) throw new Error(assetModeRes.error);
      const assetMode = assetModeRes.data;

      const isMultiAsset = assetMode.multiAssetsMargin;
      const newMultiAssetsMargin = isMultiAsset ? 'false' : 'true';
      const newModeLabel = isMultiAsset ? 'Single-Asset Mode' : 'Multi-Asset Mode';

      // If switching TO Multi-Asset, check for isolated positions
      if (!isMultiAsset && newMultiAssetsMargin === 'true') {
        const positionsRes = await client.getPositions();
        if (!positionsRes.success) throw new Error(positionsRes.error);
        const positions = positionsRes.data;
        
        const isolatedPositions = positions.filter((p: any) =>
          p.marginType?.toLowerCase() === 'isolated' || p.marginType?.toUpperCase() === 'ISOLATED'
        );

        if (isolatedPositions.length > 0) {
          // Show error with list of isolated symbols
          await cleanupButtonMessages(ctx);

          let errorMessage = `⚠️ **Cannot Switch to Multi-Asset Mode**\n\n`;
          errorMessage += `The following symbols are set to **Isolated** margin:\n\n`;

          // Store symbols in session for deep links
          ctx.session.tempIsolatedPositions = isolatedPositions.map((p: any) => p.symbol);

          isolatedPositions.forEach((pos: any, index: any) => {
            errorMessage += `• [${pos.symbol}](${getBotDeepLink(`position-iso-${index}`)})\n`;
          });

          errorMessage += `\n_Click on a symbol to change it to Cross margin_`;

          const sentMessage = await ctx.reply(errorMessage, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('« Back to Settings', 'settings_asset_mode')],
            ]),
          });
          trackButtonMessage(ctx, sentMessage.message_id);
          return;
        }
      }

      // Create SET_MULTI_ASSETS_MARGIN operation
      const operation: AsterWriteOp = {
        operation: 'SET_MULTI_ASSETS_MARGIN',
        params: {
          multiAssetsMargin: newMultiAssetsMargin,
        },
        metadata: {
          previousMode: isMultiAsset ? 'true' : 'false',
          modeLabel: newModeLabel,
        },
      };

      // Show confirmation
      const { showConfirmation } = await import('./utils/confirmDialog');
      const operationId = await showConfirmation(ctx, db, redis, ctx.session.userId, operation);

      if (!operationId) {
        // Error was already handled in showConfirmation
        return;
      }

    } catch (error) {
      console.error('[Asset Mode Toggle] Error:', error);
      await ctx.reply('❌ Failed to toggle asset mode. Please try again.');
    }
  });

  bot.action('settings_profile', async (ctx) => {
    await ctx.answerCbQuery('Profile feature coming soon!');
  });

  bot.action('settings_unlink', async (ctx) => {
    await ctx.answerCbQuery();
    await removeButtonsFromCallback(ctx);
    return ctx.scene.enter('unlink');
  });

  bot.action('settings_delete', async (ctx) => {
    await ctx.answerCbQuery('Account deletion coming soon!');
  });

  // ==================== Spot Asset Handlers ====================

  // Handle spot asset click (e.g., "spot_asset:ASTER")
  bot.action(/^spot_asset:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const asset = ctx.match[1];

    await ctx.editMessageText(
      `💱 **Trade ${asset}**\n\nWhat would you like to do?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`📈 Buy ${asset}`, `spot_buy:${asset}`)],
          [Markup.button.callback(`📉 Sell ${asset}`, `spot_sell:${asset}`)],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Handle spot buy (e.g., "spot_buy:ASTER")
  bot.action(/^spot_buy:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    // Normalize: input might be full symbol (BTCUSDT) or just asset (BTC)
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    // Aster is currently Futures-only in this integration
    if (exchange === 'aster') {
       await ctx.reply('⚠️ Aster Spot trading is not supported. Switching to Futures Long...');
       return ctx.scene.enter('market-order-wizard', {
           symbol,
           side: 'BUY',
           retryCount: 0
       });
    }

    return ctx.editMessageText(
      `📈 **Buy ${asset}**\n\nSelect amount or enter custom:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('25%', `spot_buy_pct:${asset}:25`),
            Markup.button.callback('50%', `spot_buy_pct:${asset}:50`),
          ],
          [
            Markup.button.callback('75%', `spot_buy_pct:${asset}:75`),
            Markup.button.callback('100%', `spot_buy_pct:${asset}:100`),
          ],
          [Markup.button.callback('✏️ Custom Amount', `spot_buy_custom:${asset}`)],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Handle spot sell (e.g., "spot_sell:ASTER")
  bot.action(/^spot_sell:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    // Normalize: input might be full symbol (BTCUSDT) or just asset (BTC)
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    // Aster is currently Futures-only in this integration
    if (exchange === 'aster') {
       await ctx.reply('⚠️ Aster Spot trading is not supported. Switching to Futures Short...');
       return ctx.scene.enter('market-order-wizard', {
           symbol,
           side: 'SELL',
           retryCount: 0
       });
    }

    return ctx.editMessageText(
      `📉 **Sell ${asset}**\n\nSelect amount or enter custom:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('25%', `spot_sell_pct:${asset}:25`),
            Markup.button.callback('50%', `spot_sell_pct:${asset}:50`),
          ],
          [
            Markup.button.callback('75%', `spot_sell_pct:${asset}:75`),
            Markup.button.callback('100%', `spot_sell_pct:${asset}:100`),
          ],
          [Markup.button.callback('✏️ Custom Amount', `spot_sell_custom:${asset}`)],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Handle spot buy percentage (e.g., "spot_buy_pct:ASTER:50")
  bot.action(/^spot_buy_pct:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    const percentage = ctx.match[2];
    // Normalize: input might be full symbol or just asset
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    if (exchange === 'aster') {
         await ctx.reply(`⚠️ Aster Spot trading is not supported. Switching to Futures Long (${percentage}%)...`);
         return ctx.scene.enter('market-order-wizard', {
             symbol,
             side: 'BUY',
             prefilledAmount: `${percentage}%`,
             retryCount: 0
         });
    }

    // Remove buttons from current message
    await removeButtonsFromCallback(ctx);

    // Enter wizard with prefilled percentage
    return ctx.scene.enter('spot-buy-wizard', {
      asset,
      symbol,
      prefilledAmount: `${percentage}%`,
      retryCount: 0,
    });
  });

  // Handle spot buy custom amount
  bot.action(/^spot_buy_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    // Normalize: input might be full symbol or just asset
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    if (exchange === 'aster') {
         await ctx.reply('⚠️ Aster Spot trading is not supported. Switching to Futures Long...');
         return ctx.scene.enter('market-order-wizard', {
             symbol,
             side: 'BUY',
             retryCount: 0
         });
    }

    // Remove buttons from current message
    await removeButtonsFromCallback(ctx);

    // Enter wizard
    return ctx.scene.enter('spot-buy-wizard', {
      asset,
      symbol,
      retryCount: 0,
    });
  });

  // Handle spot sell percentage (e.g., "spot_sell_pct:ASTER:50")
  bot.action(/^spot_sell_pct:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    const percentage = ctx.match[2];
    // Normalize: input might be full symbol or just asset
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    if (exchange === 'aster') {
         await ctx.reply(`⚠️ Aster Spot trading is not supported. Switching to Futures Short (${percentage}%)...`);
         return ctx.scene.enter('market-order-wizard', {
             symbol,
             side: 'SELL',
             prefilledAmount: `${percentage}%`,
             retryCount: 0
         });
    }

    // Remove buttons from current message
    await removeButtonsFromCallback(ctx);

    // Enter wizard with prefilled percentage
    return ctx.scene.enter('spot-sell-wizard', {
      asset,
      symbol,
      prefilledAmount: `${percentage}%`,
      retryCount: 0,
    });
  });

  // Handle spot sell custom amount
  bot.action(/^spot_sell_custom:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const input = ctx.match[1].toUpperCase();
    // Normalize: input might be full symbol or just asset
    const symbol = input.endsWith('USDT') || input.endsWith('USD') ? input : `${input}USDT`;
    const asset = symbol.replace(/USDT$|USD$/, '');
    const exchange = ctx.session.activeExchange || 'aster';

    if (exchange === 'aster') {
         await ctx.reply('⚠️ Aster Spot trading is not supported. Switching to Futures Short...');
         return ctx.scene.enter('market-order-wizard', {
             symbol,
             side: 'SELL',
             retryCount: 0
         });
    }

    // Remove buttons from current message
    await removeButtonsFromCallback(ctx);

    // Enter wizard
    return ctx.scene.enter('spot-sell-wizard', {
      asset,
      symbol,
      retryCount: 0,
    });
  });

  // ==================== Futures Position Handlers ====================

  // Handle perp position click (e.g., "perp_position:ASTERUSDT")
  bot.action(/^perp_position:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    await ctx.editMessageText(
      `⚡ **Manage ${symbol} Position**\n\nWhat would you like to do?`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add to Position', `perp_add:${symbol}`)],
          [Markup.button.callback('➖ Reduce Position', `perp_reduce:${symbol}`)],
          [Markup.button.callback('❌ Close Position', `perp_close:${symbol}`)],
          [Markup.button.callback('« Back', 'menu')],
        ]),
      }
    );
  });

  // Handle perp add (e.g., "perp_add:ASTERUSDT")
  bot.action(/^perp_add:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    await ctx.editMessageText(
      `➕ **Add to ${symbol} Position**\n\n_This feature is coming soon!_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('« Back', `perp_position:${symbol}`)],
        ]),
      }
    );
  });

  // Handle perp reduce (e.g., "perp_reduce:ASTERUSDT")
  bot.action(/^perp_reduce:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    await ctx.editMessageText(
      `➖ **Reduce ${symbol} Position**\n\nSelect percentage to close:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('25%', `perp_close_pct:${symbol}:25`),
            Markup.button.callback('50%', `perp_close_pct:${symbol}:50`),
          ],
          [
            Markup.button.callback('75%', `perp_close_pct:${symbol}:75`),
            Markup.button.callback('100%', `perp_close_pct:${symbol}:100`),
          ],
          [Markup.button.callback('« Back', `perp_position:${symbol}`)],
        ]),
      }
    );
  });

  // Handle perp close (e.g., "perp_close:ASTERUSDT")
  bot.action(/^perp_close:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];

    await ctx.editMessageText(
      `❌ **Close ${symbol} Position**\n\nSelect percentage to close:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('25%', `perp_close_pct:${symbol}:25`),
            Markup.button.callback('50%', `perp_close_pct:${symbol}:50`),
          ],
          [
            Markup.button.callback('75%', `perp_close_pct:${symbol}:75`),
            Markup.button.callback('100%', `perp_close_pct:${symbol}:100`),
          ],
          [Markup.button.callback('« Back', `perp_position:${symbol}`)],
        ]),
      }
    );
  });

  // Handle perp close percentage (e.g., "perp_close_pct:ASTERUSDT:50")
  bot.action(/^perp_close_pct:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const symbol = ctx.match[1];
    const percentage = ctx.match[2];

    await ctx.editMessageText(
      `⏳ **Closing ${symbol} Position**\n\nExecuting market close order (${percentage}%)...\n\n_This is a placeholder. Trading functionality coming soon!_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('« Back to Menu', 'menu')],
        ]),
      }
    );
  });

  // ==================== Write Operation Confirmation Handlers ====================

  // Handle write operation confirmation (user clicked ✅ Confirm)
  bot.action(/^write_confirm:(.+)$/, async (ctx) => {
    const operationId = ctx.match[1];
    const db = getPostgres();
    const redis = getRedis();

    try {
      await handleConfirm(ctx, db, redis, operationId);
    } catch (error: any) {
      console.error('[WriteConfirm] Error:', error);
      await ctx.answerCbQuery('Error confirming operation');
      await ctx.editMessageText(`❌ Error: ${error.message}`);
    }
  });

  // Handle write operation cancellation (user clicked ❌ Cancel)
  bot.action(/^write_cancel:(.+)$/, async (ctx) => {
    const operationId = ctx.match[1];
    const db = getPostgres();
    const redis = getRedis();

    try {
      await handleCancel(ctx, db, redis, operationId);
    } catch (error: any) {
      console.error('[WriteCancel] Error:', error);
      await ctx.answerCbQuery('Error cancelling operation');
    }
  });

  // Handle write operation recalculation (user clicked 🔄 Re-calc)
  bot.action(/^write_recalc:(.+)$/, async (ctx) => {
    const operationId = ctx.match[1];
    const db = getPostgres();
    const redis = getRedis();

    try {
      await handleRecalc(ctx, db, redis, operationId);
    } catch (error: any) {
      console.error('[WriteRecalc] Error:', error);
      await ctx.answerCbQuery('Error recalculating');
    }
  });

  // Handle return to position (from success/error/cancel messages)
  bot.action(/^return_position:(.+)$/, async (ctx) => {
    // Normalize symbol to fix legacy corrupted symbols (e.g., BTCUSDTUSDT)
    const symbol = normalizeSymbol(ctx.match[1]);

    try {
      await ctx.answerCbQuery();
      await showPositionManagement(ctx, symbol, false);
    } catch (error: any) {
      console.error('[ReturnPosition] Error:', error);
      await ctx.answerCbQuery('Error loading position');
    }
  });

  // ==================== Referrals Command & Handler ====================

  bot.command('referrals', async (ctx) => {
    if (!ctx.session.userId) {
      await ctx.reply('❌ Please use /start first.');
      return;
    }

    const db = getPostgres();
    const { getUserReferralCode, getReferralStats, getReferredUsers } = await import('./db/referrals');

    try {
      const code = await getUserReferralCode(db, ctx.session.userId);
      const stats = await getReferralStats(db, ctx.session.userId);
      const recentReferrals = await getReferredUsers(db, ctx.session.userId, 10);

      let message = '📊 **Your Referrals**\n\n';
      message += `🎁 **Your Referral Code:** \`${code}\`\n\n`;
      message += `**Statistics:**\n`;
      message += `• Total Sign-ups: ${stats.totalReferrals}\n`;
      message += `• Verified Users: ${stats.verifiedReferrals}\n`;
      message += `• Active Traders: ${stats.linkedReferrals}\n\n`;

      if (recentReferrals.length > 0) {
        message += `**Recent Referrals:**\n`;
        recentReferrals.forEach((ref, i) => {
          const status = ref.is_verified ? '✅' : '⏳';
          const name = ref.username || `User ${ref.telegram_id}`;
          message += `${i + 1}. ${status} ${name}\n`;
        });
        message += '\n';
      }

      message += `**Share your code:**\n`;
      message += `\`/start ${code}\`\n\n`;
      message += `_Share this message with friends to invite them!_`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh Stats', 'referrals')],
          [Markup.button.callback('« Back to Menu', 'menu')],
        ]),
      });
    } catch (error) {
      console.error('[Referrals Command] Error:', error);
      await ctx.reply('❌ Failed to load referral stats. Please try again.');
    }
  });

  bot.action('referrals', async (ctx) => {
    await ctx.answerCbQuery('🔄 Refreshing...');

    if (!ctx.session.userId) {
      await ctx.editMessageText('❌ Session error. Please use /start.');
      return;
    }

    const db = getPostgres();
    const { getUserReferralCode, getReferralStats, getReferredUsers } = await import('./db/referrals');

    try {
      const code = await getUserReferralCode(db, ctx.session.userId);
      const stats = await getReferralStats(db, ctx.session.userId);
      const recentReferrals = await getReferredUsers(db, ctx.session.userId, 10);

      let message = '📊 **Your Referrals**\n\n';
      message += `🎁 **Your Referral Code:** \`${code}\`\n\n`;
      message += `**Statistics:**\n`;
      message += `• Total Sign-ups: ${stats.totalReferrals}\n`;
      message += `• Verified Users: ${stats.verifiedReferrals}\n`;
      message += `• Active Traders: ${stats.linkedReferrals}\n\n`;

      if (recentReferrals.length > 0) {
        message += `**Recent Referrals:**\n`;
        recentReferrals.forEach((ref, i) => {
          const status = ref.is_verified ? '✅' : '⏳';
          const name = ref.username || `User ${ref.telegram_id}`;
          message += `${i + 1}. ${status} ${name}\n`;
        });
        message += '\n';
      }

      message += `**Share your code:**\n`;
      message += `\`/start ${code}\`\n\n`;
      message += `_Share this message with friends to invite them!_`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh Stats', 'referrals')],
          [Markup.button.callback('« Back to Menu', 'menu')],
        ]),
      });
    } catch (error) {
      console.error('[Referrals Action] Error:', error);
      await ctx.answerCbQuery('Error loading stats');
    }
  });

  // ==================== Symbol Search Handler ====================
  // Handle text messages for symbol search (e.g., "ASTER", "BTC")
  bot.on('text', async (ctx) => {
    // Skip if user is in a scene (wizard flow)
    if (ctx.scene?.current) return;

    // Skip if waiting for input (let positions composer handle it)
    if (ctx.session.waitingForInput) return;

    // Skip if not linked
    if (!ctx.session.isLinked) return;

    const searchTerm = ctx.message.text.trim().toUpperCase();

    // Skip if it's a command
    if (searchTerm.startsWith('/')) return;

    // Search for matching symbols
    const spotSymbols = getSpotTradingSymbols();
    const futuresSymbols = getFuturesTradingSymbols();

    const matchingSpot = spotSymbols.filter(s => s.includes(searchTerm));
    const matchingFutures = futuresSymbols.filter(s => s.includes(searchTerm));

    // Clean up old button messages in background (fire and forget)
    await cleanupButtonMessages(ctx);

    // If no matches, show error with back button
    if (matchingSpot.length === 0 && matchingFutures.length === 0) {
      const sentMessage = await ctx.reply(
        `🔍 **No symbols found for "${searchTerm}"**\n\nTry searching for:\n• Asset names: BTC, ETH, ASTER\n• Full symbols: BTCUSDT, ETHUSDT`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
        }
      );
      trackButtonMessage(ctx, sentMessage.message_id);
      return;
    }

    // Build results message
    let message = `🔍 **Search Results for "${searchTerm}"**\n\n`;

    // Store matches in session for deep links
    const allMatches: Array<{ symbol: string; type: 'spot' | 'futures' }> = [];

    if (matchingSpot.length > 0) {
      message += '**💱 Spot Markets:**\n';
      matchingSpot.slice(0, 10).forEach((symbol, index) => {
        const idx = allMatches.length;
        allMatches.push({ symbol, type: 'spot' });
        message += `• [${symbol}](${getBotDeepLink(`symbol-${idx}`)})\n`;
      });
      if (matchingSpot.length > 10) {
        message += `_...and ${matchingSpot.length - 10} more_\n`;
      }
      message += '\n';
    }

    if (matchingFutures.length > 0) {
      message += '**⚡ Futures Markets:**\n';
      matchingFutures.slice(0, 10).forEach((symbol, index) => {
        const idx = allMatches.length;
        allMatches.push({ symbol, type: 'futures' });
        message += `• [${symbol}](${getBotDeepLink(`symbol-${idx}`)})\n`;
      });
      if (matchingFutures.length > 10) {
        message += `_...and ${matchingFutures.length - 10} more_\n`;
      }
    }

    message += `\n_Click on a symbol to see details and trade_`;

    // Store matches in session
    ctx.session.searchResults = allMatches;

    const sentMessage = await ctx.reply(message, {
      parse_mode: 'Markdown',
      link_preview_options: {
        is_disabled: true,
      },
      ...Markup.inlineKeyboard([[Markup.button.callback('« Back to Menu', 'menu')]]),
    });

    trackButtonMessage(ctx, sentMessage.message_id);
  });


  console.log('[Bot] ✅ Commands configured');
}
