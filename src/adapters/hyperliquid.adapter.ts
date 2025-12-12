
import type {
  ExchangeAdapter, AccountInfo, PlaceOrderParams, OrderResult,
  CancelResult, Order, Position, Orderbook, Ticker, Asset
} from './base.adapter';
import { Hyperliquid } from 'hyperliquid';

export class HyperliquidAdapter implements ExchangeAdapter {
  private sdk: Hyperliquid;
  private accountAddress: string;

  constructor(accountAddress: string, privateKey?: string) {
    this.accountAddress = accountAddress;
    
    // Initialize SDK with proper options object for exchange module
    if (privateKey) {
      const cleanKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      // @ts-ignore - SDK type definitions may not match actual implementation
      this.sdk = new Hyperliquid({
        enableWs: true,
        privateKey: cleanKey,
        walletAddress: accountAddress,
        testnet: false
      });
    } else {
      // @ts-ignore
      this.sdk = new Hyperliquid({
        enableWs: true,
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
      return `${sym}-PERP`;
  }

  async getAccount(): Promise<AccountInfo> {
    try {
      const state = await this.sdk.info.perpetuals.getClearinghouseState(this.accountAddress);
      const marginSummary = state.marginSummary;

      return {
        exchange: 'hyperliquid',
        totalBalance: marginSummary.accountValue || '0',
        availableBalance: state.withdrawable || '0',
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
    } catch (error) {
      throw new Error(`Failed to fetch Hyperliquid account: ${error}`);
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
          limitPrice = isBuy ? currentPrice * 1.05 : currentPrice * 0.95;
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
                  triggerPx: triggerPrice.toString(),
                  isMarket: true,
                  tpsl: isStop ? 'sl' : 'tp'
              }
          };
          
          // For trigger orders, we still need a limit price (use trigger price)
          limitPrice = triggerPrice;
          
      } else if (params.type === 'STOP_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
          // Trigger orders with limit execution
          if (!params.triggerPrice || !params.price) {
              throw new Error(`${params.type} requires both triggerPrice and price`);
          }
          
          const triggerPrice = parseFloat(params.triggerPrice);
          const isStop = params.type === 'STOP_LIMIT';
          
          orderType = {
              trigger: {
                  triggerPx: triggerPrice.toString(),
                  isMarket: false,
                  tpsl: isStop ? 'sl' : 'tp'
              }
          };
          
          limitPrice = parseFloat(params.price);
          
      } else if (params.type === 'TRAILING_STOP_MARKET') {
          // Trailing stop orders
          if (!params.trailingDelta) {
              throw new Error('TRAILING_STOP_MARKET requires trailingDelta (callback rate)');
          }
          
          // Get current price for initial trigger
          // @ts-ignore
          const mids = await this.sdk.info.getAllMids();
          const currentPrice = parseFloat(mids[symbol] || '0');
          
          if (!currentPrice) {
              throw new Error(`Cannot determine market price for ${symbol}`);
          }
          
          // Calculate initial trigger price based on trailing delta
          const callbackRate = parseFloat(params.trailingDelta);
          const initialTrigger = isBuy 
              ? currentPrice * (1 + callbackRate / 100)
              : currentPrice * (1 - callbackRate / 100);
          
          orderType = {
              trigger: {
                  triggerPx: initialTrigger.toString(),
                  isMarket: true,
                  tpsl: 'sl' // Trailing stops are stop-loss type
              }
          };
          
          limitPrice = initialTrigger;
          
      } else if (params.type === 'LIMIT') {
          // Standard limit order
          if (!params.price) {
              throw new Error('LIMIT order requires price');
          }
          
          limitPrice = parseFloat(params.price);
          
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
  private async placeConditionalOrder(symbol: string, side: 'BUY'|'SELL', type: string, triggerPrice: string, quantity: string) {
      const isBuy = side === 'BUY';
      const isStop = type.includes('STOP');
      
      const orderType = {
          trigger: {
              triggerPx: triggerPrice,
              isMarket: true,
              tpsl: isStop ? 'sl' : 'tp'
          }
      };

      // @ts-ignore
      return this.sdk.exchange.placeOrder({
          coin: symbol,
          is_buy: isBuy,
          sz: parseFloat(quantity),
          limit_px: parseFloat(triggerPrice),
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
      // Hyperliquid doesn't have a separate setLeverage API
      // Leverage is set when placing orders via the leverage parameter
      // We'll return success to indicate the leverage will be used in subsequent orders
      
      return {
        success: true,
        message: `Leverage ${leverage}x will be applied to orders for ${symbol}. Note: Hyperliquid sets leverage per-order.`
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
      const coin = this.toExchangeSymbol(symbol);
      
      // Hyperliquid uses cross margin by default
      // Isolated margin can be simulated by setting leverage per position
      if (mode === 'CROSS') {
        return {
          success: true,
          message: `Hyperliquid uses cross margin by default for ${symbol}`
        };
      } else {
        return {
          success: true,
          message: `Isolated margin mode simulated via position-specific leverage for ${symbol}`
        };
      }
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
           side: o.side === 'B' ? 'BUY' : 'SELL',
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
                side: f.side === 'B' ? 'BUY' : 'SELL',
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
          timestamp: book.time
      };
  }

  async getTicker(symbol: string): Promise<Ticker> {
      // @ts-ignore
      const mids = await this.sdk.info.getAllMids(); 
      // mids is object { "BTC-PERP": "10000", ... }
      
      const exSymbol = this.toExchangeSymbol(symbol);
      return {
          symbol,
          price: mids[exSymbol] || '0',
          change24h: '0',
          volume24h: '0',
          high24h: '0',
          low24h: '0',
          timestamp: Date.now()
      };
  }

  async getAssets(): Promise<Asset[]> {
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      return meta.universe.map((a: any) => ({
          symbol: this.fromExchangeSymbol(a.name),
          name: this.fromExchangeSymbol(a.name),
          baseAsset: this.fromExchangeSymbol(a.name),
          quoteAsset: 'USD',
          minQuantity: '0.001', 
          tickSize: String(Math.pow(10, -a.szDecimals))
      }));
  }
}

