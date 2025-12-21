
import type {
  ExchangeAdapter, AccountInfo, PlaceOrderParams, OrderResult,
  CancelResult, Order, Position, Orderbook, Ticker, Asset
} from './base.adapter';
import { Hyperliquid } from 'hyperliquid';

export class HyperliquidAdapter implements ExchangeAdapter {
  private sdk: Hyperliquid;
  private accountAddress: string;

  constructor(accountAddress: string, privateKey?: string) {
    this.accountAddress = accountAddress.toLowerCase().trim();

    // Initialize SDK with proper options object for exchange module
    if (privateKey) {
      const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      // @ts-ignore - SDK type definitions may not match actual implementation
      this.sdk = new Hyperliquid({
        enableWs: false,
        privateKey: cleanKey,
        walletAddress: accountAddress,
        testnet: false
      });
    } else {
      // @ts-ignore
      this.sdk = new Hyperliquid({
        enableWs: false,
        testnet: false
      });
    }
  }

  // Helper to normalize symbols (Exchange -> App)
  private fromExchangeSymbol(sym: string): string {
    return sym.replace(/-PERP$/, '');
  }

  // Helper to denormalize symbols (App -> Exchange)
  private toExchangeSymbol(sym: string): string {
    if (sym.includes('-PERP')) return sym;

    // Handle "ETHUSDT" -> "ETH" for universal compatibility
    let clean = sym;
    if (clean.endsWith('USDT')) {
      clean = clean.replace('USDT', '');
    }

    return `${clean}-PERP`;
  }

  async getAccount(): Promise<AccountInfo> {
    try {
      const address = this.accountAddress.toLowerCase().trim();
      console.log(`[Hyperliquid] Fetching account for: '${address}' (Length: ${address.length})`);
      if (!address.startsWith('0x') || address.length !== 42) {
        console.warn(`[Hyperliquid] ⚠️ WARNING: Address '${address}' may be invalid! Expected 42 chars starting with 0x.`);
      }
      
      
      // Use direct fetch to bypass SDK deserialization error
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           type: "clearinghouseState",
           user: address
        })
      });

      if (!response.ok) {
        throw new Error(`Hyperliquid API Error: ${response.status} ${response.statusText}`);
      }

      const state: any = await response.json();
      const marginSummary = state.marginSummary;

      return {
        exchange: 'hyperliquid',
        totalBalance: String(marginSummary.accountValue || '0'),
        availableBalance: String(state.withdrawable || '0'),
        positions: state.assetPositions.map((p: any) => ({
          symbol: this.fromExchangeSymbol(p.position.coin),
          size: p.position.szi,
          entryPrice: p.position.entryPx,
          markPrice: p.position.positionValue,
          unrealizedPnl: p.position.unrealizedPnl,
          side: parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT',
          leverage: p.position.leverage.value.toString(),
          liquidationPrice: p.position.liquidationPx
        })),
        timestamp: Date.now()
      };
    } catch (error: any) {
      console.error('[Hyperliquid] getAccount Error:', error);
      throw new Error(`Failed to fetch Hyperliquid account: ${error.message}`);
    }
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    try {
      // Ensure connected (initializes exchange/ws if needed)
      // @ts-ignore
      if (!this.sdk.isWebSocketConnected || !this.sdk.isWebSocketConnected()) {
        // @ts-ignore
        await this.sdk.connect();
      }

      const isBuy = params.side === 'BUY';
      const symbol = this.toExchangeSymbol(params.symbol);

      // Default order type: Limit with GTC
      let orderType: any = { limit: { tif: 'Gtc' } };
      let limitPrice = parseFloat(params.price || '0');

      // Handle different order types
      // Helper to match Hyperliquid's strict precision (5 significant figures)
      const formatPrice = (price: number): number => {
        return parseFloat(price.toPrecision(5));
      };

      if (params.type === 'MARKET') {
        // Hyperliquid doesn't have true market orders
        // Use aggressive limit order (IOC at far price)
        // @ts-ignore
        const mids = await this.sdk.info.getAllMids();
        const currentPrice = parseFloat(mids[symbol] || '0');

        if (!currentPrice) {
          throw new Error(`Cannot determine market price for ${symbol}`);
        }

        // Set aggressive price: +5% for buy, -5% for sell
        // MUST round to 5 significant figures (Hyperliquid standard)
        const aggressive = isBuy ? currentPrice * 1.05 : currentPrice * 0.95;

        limitPrice = formatPrice(aggressive);
        orderType = { limit: { tif: 'Ioc' } }; // IOC to ensure immediate execution

      } else if (params.type === 'STOP_MARKET' || params.type === 'TAKE_PROFIT_MARKET') {
        // Trigger orders with market execution
        if (!params.triggerPrice) {
          throw new Error(`${params.type} requires triggerPrice`);
        }

        const triggerPrice = parseFloat(params.triggerPrice);
        const isStop = params.type === 'STOP_MARKET';

        orderType = {
          trigger: {
            triggerPx: formatPrice(triggerPrice).toString(),
            isMarket: true,
            tpsl: isStop ? 'sl' : 'tp'
          }
        };

        // For trigger orders, we still need a limit price (use trigger price)
        limitPrice = formatPrice(triggerPrice);

      } else if (params.type === 'STOP_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
        // Trigger orders with limit execution
        if (!params.triggerPrice || (!params.price && !params.stopLimitPrice)) {
          throw new Error(`${params.type} requires both triggerPrice and price (or stopLimitPrice)`);
        }

        const triggerPrice = parseFloat(params.triggerPrice);
        const isStop = params.type === 'STOP_LIMIT';

        orderType = {
          trigger: {
            triggerPx: formatPrice(triggerPrice).toString(),
            isMarket: false,
            tpsl: isStop ? 'sl' : 'tp'
          }
        };

        const rawLimit = parseFloat((params.stopLimitPrice || params.price) as string);
        limitPrice = formatPrice(rawLimit);

      } else if (params.type === 'TRAILING_STOP_MARKET') {
        // Trailing stop orders
        // Hyperliquid does not natively support server-side trailing stops in the standard order API.
        // They must be implemented via the Algo/TWAP system or client-side.
        // To avoid misleading behavior (placing a static stop), we throw an error.
        throw new Error('TRAILING_STOP_MARKET is not natively supported by Hyperliquid standard API.');

      } else if (params.type === 'OCO') {
        throw new Error('OCO orders are not supported by Hyperliquid adapter yet.');

      } else if (params.type === 'LIMIT') {
        // Standard limit order
        if (!params.price) {
          throw new Error('LIMIT order requires price');
        }

        limitPrice = formatPrice(parseFloat(params.price));

        // Handle special time-in-force options
        if (params.postOnly) {
          orderType = { limit: { tif: 'Alo' } }; // Add Liquidity Only
        } else if (params.timeInForce === 'IOC') {
          orderType = { limit: { tif: 'Ioc' } }; // Immediate or Cancel
        } else if (params.timeInForce === 'FOK') {
          // Hyperliquid doesn't support FOK, use IOC as closest alternative
          orderType = { limit: { tif: 'Ioc' } };
          console.warn('FOK not supported on Hyperliquid, using IOC instead');
        } else {
          orderType = { limit: { tif: 'Gtc' } }; // Good Till Cancel (default)
        }
      } else {
        throw new Error(`Unsupported order type: ${params.type}`);
      }

      // Place the order
      // @ts-ignore
      const result = await this.sdk.exchange.placeOrder({
        coin: symbol,
        is_buy: isBuy,
        sz: parseFloat(params.quantity),
        limit_px: limitPrice,
        order_type: orderType,
        reduce_only: !!params.reduceOnly
      });

      if (result.status === 'err') {
        throw new Error(`Order failed: ${result.response}`);
      }

      // Check specific order statuses for errors
      const statuses = result.response?.data?.statuses || [];
      const firstError = statuses.find((s: any) => s.error);
      if (firstError) {
        throw new Error(`Order rejected: ${firstError.error}`);
      }

      // Extract order ID
      const firstStatus = statuses[0];
      let oid: number | undefined;

      if (firstStatus?.resting?.oid) {
        oid = firstStatus.resting.oid;
      } else if (firstStatus?.filled) {
        // Order was immediately filled
        oid = firstStatus.filled.oid || Date.now();
      }

      const status = firstStatus?.filled ? 'FILLED' : 'NEW';

      // Handle TP/SL attachment for main orders
      if (oid && (params.takeProfit || params.stopLoss)) {
        const childSide = params.side === 'BUY' ? 'SELL' : 'BUY';
        const qty = params.quantity;

        // Attach Take Profit
        if (params.takeProfit) {
          this.placeConditionalOrder(symbol, childSide, 'TAKE_PROFIT_MARKET', params.takeProfit, qty)
            .then(() => console.log('   ✅ Attached TP placed'))
            .catch(e => console.warn(`   ⚠️ Failed to attach TP: ${e.message}`));
        }

        // Attach Stop Loss
        if (params.stopLoss) {
          this.placeConditionalOrder(symbol, childSide, 'STOP_MARKET', params.stopLoss, qty)
            .then(() => console.log('   ✅ Attached SL placed'))
            .catch(e => console.warn(`   ⚠️ Failed to attach SL: ${e.message}`));
        }
      }

      return {
        orderId: String(oid || Date.now()),
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price || limitPrice.toString(),
        status: status as any,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to place Hyperliquid order: ${error}`);
    }
  }

  // Helper for placing conditional orders (TP/SL)
  private async placeConditionalOrder(symbol: string, side: 'BUY' | 'SELL', type: string, triggerPrice: string, quantity: string) {
    const isBuy = side === 'BUY';
    const isStop = type.includes('STOP');

    // Helper to match Hyperliquid's strict precision (5 significant figures)
    const formatPrice = (price: number): number => {
      return parseFloat(price.toPrecision(5));
    };

    const priceVal = parseFloat(triggerPrice);
    const formattedPrice = formatPrice(priceVal);

    const orderType = {
      trigger: {
        triggerPx: formattedPrice.toString(),
        isMarket: true,
        tpsl: (isStop ? 'sl' : 'tp') as 'sl' | 'tp'
      }
    };

    // @ts-ignore
    return this.sdk.exchange.placeOrder({
      coin: symbol,
      is_buy: isBuy,
      sz: parseFloat(quantity),
      limit_px: formattedPrice,
      order_type: orderType,
      reduce_only: true
    });
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<CancelResult> {
    if (!symbol) throw new Error("Symbol required for Hyperliquid cancel");

    try {
      // @ts-ignore
      await this.sdk.exchange.cancelOrder({
        coin: this.toExchangeSymbol(symbol),
        o: parseInt(orderId)
      });

      return {
        orderId,
        symbol,
        status: 'CANCELED',
        message: 'Order canceled'
      };
    } catch (error) {
      return {
        orderId,
        symbol,
        status: 'FAILED',
        message: `Failed: ${error}`
      };
    }
  }

  /**
   * Cancel all open orders for a symbol or all symbols
   */
  async cancelAllOrders(symbol?: string): Promise<{ success: boolean; canceledCount: number; message: string }> {
    try {
      // Get all open orders
      const openOrders = await this.getOpenOrders(symbol);

      if (openOrders.length === 0) {
        return {
          success: true,
          canceledCount: 0,
          message: 'No open orders to cancel'
        };
      }

      // Cancel each order
      const cancelPromises = openOrders.map(order =>
        this.cancelOrder(order.orderId, order.symbol)
      );

      const results = await Promise.allSettled(cancelPromises);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.length - successCount;

      return {
        success: failedCount === 0,
        canceledCount: successCount,
        message: `Canceled ${successCount} orders${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      };
    } catch (error) {
      return {
        success: false,
        canceledCount: 0,
        message: `Failed to cancel orders: ${error}`
      };
    }
  }

  /**
   * Set leverage for a symbol
   * Note: Hyperliquid sets leverage per-order rather than per-symbol
   */
  async setLeverage(symbol: string, leverage: number): Promise<{ success: boolean; message?: string }> {
    try {
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      const cleanSymbol = this.fromExchangeSymbol(this.toExchangeSymbol(symbol)); // "ETH"

      // Find matching asset in universe
      // @ts-ignore
      const assetInfo = meta.universe.find((u: any) =>
        u.name === cleanSymbol ||
        u.name === `${cleanSymbol}-PERP` ||
        u.name === symbol
      );

      if (!assetInfo) {
        throw new Error(`Asset not found: ${cleanSymbol}`);
      }

      console.log(`Setting leverage for ${assetInfo.name} (Index: ${meta.universe.indexOf(assetInfo)})`);

      // Correct SDK Signature found in node_modules: updateLeverage(symbol: string, leverageMode: string, leverage: number)
      // @ts-ignore
      await this.sdk.exchange.updateLeverage(assetInfo.name, "cross", leverage);

      return {
        success: true,
        message: `Leverage set to ${leverage}x for ${symbol} (${assetInfo.name})`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to set leverage: ${error.message}`
      };
    }
  }

  /**
   * Set margin mode (CROSS or ISOLATED)
   * Note: Hyperliquid primarily uses cross margin
   */
  async setMarginMode(symbol: string, mode: 'CROSS' | 'ISOLATED'): Promise<{ success: boolean; message?: string }> {
    try {
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      const cleanSymbol = this.fromExchangeSymbol(this.toExchangeSymbol(symbol));

      // Find matching asset in universe
      // @ts-ignore
      const assetInfo = meta.universe.find((u: any) =>
        u.name === cleanSymbol ||
        u.name === `${cleanSymbol}-PERP` ||
        u.name === symbol
      );

      if (!assetInfo) throw new Error(`Asset not found: ${cleanSymbol}`);

      const leverageMode = mode === 'CROSS' ? 'cross' : 'isolated';
      // Default to 10x leverage when switching margin mode if not specified
      const defaultLeverage = 10;

      // @ts-ignore
      await this.sdk.exchange.updateLeverage(assetInfo.name, leverageMode, defaultLeverage);

      return {
        success: true,
        message: `Set ${mode} margin for ${symbol} (${assetInfo.name}) at ${defaultLeverage}x`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to set margin mode: ${error.message}`
      };
    }
  }

  /**
   * Get current margin mode for a symbol
   * Hyperliquid uses cross margin by default
   */
  async getMarginMode(symbol: string): Promise<'CROSS' | 'ISOLATED'> {
    // Hyperliquid primarily uses cross margin
    return 'CROSS';
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      // @ts-ignore
      const orders = await this.sdk.info.getUserOpenOrders(this.accountAddress);

      // Filter first to avoid unnecessary mapping if symbol provided
      let filtered = orders;
      if (symbol) {
        const exSymbol = this.toExchangeSymbol(symbol);
        filtered = orders.filter((o: any) => o.coin === exSymbol);
      }

      return filtered.map((o: any) => ({
        orderId: String(o.oid),
        symbol: this.fromExchangeSymbol(o.coin),
        side: (o.side === 'B' || o.side === 'b') ? 'BUY' : 'SELL',
        type: 'LIMIT' as any,
        quantity: o.sz,
        price: o.limitPx,
        filled: '0',
        status: 'NEW',
        timestamp: o.timestamp
      }));
    } catch (error) {
      throw new Error(`Failed to fetch open orders: ${error}`);
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
    try {
      // @ts-ignore
      const fills = await this.sdk.info.getUserFills(this.accountAddress);

      let filtered = fills;
      if (symbol) {
        const exSymbol = this.toExchangeSymbol(symbol);
        filtered = fills.filter((f: any) => f.coin === exSymbol);
      }

      return filtered
        .slice(0, limit)
        .map((f: any) => ({
          orderId: String(f.oid),
          symbol: this.fromExchangeSymbol(f.coin),
          side: (f.side === 'B' || f.side === 'b') ? 'BUY' : 'SELL',
          type: 'LIMIT' as any,
          quantity: f.sz,
          price: f.px,
          filled: f.sz,
          status: 'FILLED',
          timestamp: f.time
        }));
    } catch (error) {
      throw new Error(`Failed to fetch history: ${error}`);
    }
  }

  async getPositions(symbol?: string): Promise<Position[]> {
    const account = await this.getAccount();
    if (!symbol) return account.positions || [];
    return (account.positions || []).filter(p => p.symbol === symbol);
  }

  async getOrderbook(symbol: string, depth: number = 20): Promise<Orderbook> {
    // @ts-ignore
    const book = await this.sdk.info.getL2Book(this.toExchangeSymbol(symbol));
    return {
      symbol,
      bids: book.levels[0].slice(0, depth).map((b: any) => [b.px, b.sz]),
      asks: book.levels[1].slice(0, depth).map((a: any) => [a.px, a.sz]),
      // @ts-ignore
      timestamp: book.time || Date.now()
    };
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
        // @ts-ignore
        const mids = await this.sdk.info.getAllMids(); 
        // mids could be { "BTC": "90000", "ETH": "...", ... } OR { "BTC-PERP": ... }
        // We try multiple variants to be safe

        const exSymbol = this.toExchangeSymbol(symbol); // e.g. BTC-PERP
        const baseSymbol = this.fromExchangeSymbol(symbol); // e.g. BTC

        // Try exact match, exchange symbol, or base symbol
        const price = mids[symbol] || mids[exSymbol] || mids[baseSymbol];

        if (!price) {
            console.warn(`[Hyperliquid] Ticker not found for ${symbol} in Available Mids keys (Sample: ${Object.keys(mids).slice(0,3)})`);
            throw new Error(`Price not found for ${symbol}`);
        }

        return {
        symbol,
        price: price,
        change24h: '0', // Hyperliquid basic ticker doesn't give 24h stats easily without diff API
        volume24h: '0',
        high24h: '0',
        low24h: '0',
        timestamp: Date.now()
        };
    } catch (error) {
        console.warn(`[Hyperliquid] Failed to fetch ticker for ${symbol}: ${error}`);
        throw new Error(`Market data unavailable for ${symbol}`);
    }
  }

  async getAssets(): Promise<Asset[]> {
    // @ts-ignore
    const meta = await this.sdk.info.perpetuals.getMeta();
    return meta.universe.map((a: any) => ({
      symbol: this.fromExchangeSymbol(a.name),
      name: this.fromExchangeSymbol(a.name),
      baseAsset: this.fromExchangeSymbol(a.name),
      quoteAsset: 'USD',
      minQuantity: a.szDecimals ? (1 / Math.pow(10, a.szDecimals)).toFixed(a.szDecimals) : '0.00001',
      stepSize: a.szDecimals ? (1 / Math.pow(10, a.szDecimals)).toFixed(a.szDecimals) : '0.00001',
      maxQuantity: undefined,
      tickSize: String(Math.pow(10, -a.szDecimals))
    }));
  }

  async getFills(symbol?: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           type: "userFills",
           user: this.accountAddress
        })
      });

      const fills: any = await response.json();
      
      if (!Array.isArray(fills)) {
         return [];
      }

      let filtered = fills;
      if (symbol) {
        const exSymbol = this.toExchangeSymbol(symbol);
        filtered = fills.filter((f: any) => f.coin === exSymbol);
      }

      return filtered
        .slice(0, limit)
        .map((f: any) => ({
          orderId: String(f.oid),
          symbol: this.fromExchangeSymbol(f.coin),
          side: (f.side === 'B' || f.side === 'b') ? 'BUY' : 'SELL',
          price: f.px,
          quantity: f.sz,
          fee: f.fee,
          feeCurrency: 'USDC', // Hyperliquid mostly settles in USDC
          timestamp: f.time
        }));
    } catch (error) {
      throw new Error(`Failed to fetch fills: ${error}`);
    }
  }

  async closePosition(symbol: string): Promise<OrderResult> {
    try {
       // 1. Get current position
       const positions = await this.getPositions(symbol);
       const position = positions.find(p => p.symbol === symbol);

       if (!position || parseFloat(position.size) === 0) {
         throw new Error(`No open position found for ${symbol}`);
       }

       // 2. Prepare Reduce-Only Market Order
       // Hyperliquid doesn't have true market orders, so we simulate with aggressive limit
       const size = parseFloat(position.size);
       const side = size > 0 ? 'SELL' : 'BUY';
       const quantity = Math.abs(size).toString();

       // We can reuse placeOrder with 'reduceOnly' = true
       return await this.placeOrder({
         symbol,
         side,
         type: 'MARKET',
         quantity,
         models: undefined, // Type compat
         reduceOnly: true
       } as any);

    } catch (error) {
        throw new Error(`Failed to close position: ${error}`);
    }
  }

  async setPositionTPSL(symbol: string, tpPrice?: string, slPrice?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Similar to Aster, we identify position and place triggers
      // Note: Hyperliquid supports setting TP/SL directly on a position via specific API, BUT SDK primarily supports placing trigger orders.
      // We will place trigger orders with reduceOnly=true.

      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol);
      if (!position || parseFloat(position.size) === 0) throw new Error('No open position');

      const isLong = position.side === 'LONG';
      const side = isLong ? 'SELL' : 'BUY';
      const quantity = Math.abs(parseFloat(position.size)).toString();

      const results = [];

      // Place Take Profit
      if (tpPrice) {
        await this.placeConditionalOrder(symbol, side, 'TAKE_PROFIT_MARKET', tpPrice, quantity);
        results.push('TP Placed');
      }

      // Place Stop Loss
      if (slPrice) {
        await this.placeConditionalOrder(symbol, side, 'STOP_MARKET', slPrice, quantity);
        results.push('SL Placed');
      }

      return {
        success: true,
        message: `Set TP/SL for ${symbol}: ${results.join(', ')}`
      };
    } catch (error: any) {
        return { success: false, message: `Failed to set TP/SL: ${error.message}` };
    }
  }

  async updatePositionMargin(symbol: string, amount: string, type: 'ADD' | 'REMOVE'): Promise<{ success: boolean; message: string }> {
    try {
      // Get current position to determine direction
      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol);
      
      if (!position || parseFloat(position.size) === 0) {
        throw new Error('No open position found for margin adjustment');
      }

      const exSymbol = this.toExchangeSymbol(symbol);
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      const assetId = meta.universe.findIndex((u: any) => u.name === exSymbol);
      
      if (assetId === -1) throw new Error('Asset not found');

      // Determine if position is long (buy) or short (sell)
      const isBuy = position.side === 'LONG';
      
      // Calculate the new target leverage implied by margin change
      // For Hyperliquid, we need to pass the new total isolated margin (ntli)
      // If ADD: increase margin, if REMOVE: decrease margin
      const currentMargin = parseFloat(position.size) * parseFloat(position.entryPrice) / (parseFloat(position.leverage || '1'));
      const marginChange = parseFloat(amount);
      const newMargin = type === 'ADD' ? currentMargin + marginChange : currentMargin - marginChange;

      if (newMargin <= 0) {
        throw new Error('Cannot remove more margin than available');
      }

      // @ts-ignore - SDK method: updateIsolatedMargin(asset: number, isBuy: boolean, ntli: number)
      await this.sdk.exchange.updateIsolatedMargin(assetId, isBuy, newMargin);

      return {
        success: true,
        message: `Successfully ${type === 'ADD' ? 'added' : 'removed'} ${amount} margin for ${symbol}`
      };
    } catch (error: any) {
       return { success: false, message: `Failed to update margin: ${error.message}` };
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number = 200): Promise<any[]> {
    try {
      const exSymbol = this.toExchangeSymbol(symbol).replace('-PERP', ''); // API expects "ETH" for PERP

      const endTime = Date.now();
      // Estimate start time based on limit & timeframe
      // Rough calc: limit * minutes * 60000
      let minutes = 15;
      if (timeframe === '1m') minutes = 1;
      else if (timeframe === '5m') minutes = 5;
      else if (timeframe === '15m') minutes = 15;
      else if (timeframe === '1h') minutes = 60;
      else if (timeframe === '4h') minutes = 240;
      else if (timeframe === '1d') minutes = 1440;

      const startTime = endTime - (limit * minutes * 60 * 1000);

      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           type: "candleSnapshot",
           req: {
             coin: exSymbol,
             interval: timeframe,
             startTime: startTime,
             endTime: endTime
           }
        })
      });

      const data: any = await response.json();
      
      if (!Array.isArray(data)) {
         return [];
      }

      return data.map((c: any) => ({
        timestamp: c.t,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
        volume: c.v
      }));

    } catch (error) {
       console.warn(`OHLCV Fetch Error: ${error}`);
       return [];
    }
  }
}
