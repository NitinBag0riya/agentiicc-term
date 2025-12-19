
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
    this.sdk = new Hyperliquid({
        enableWs: false,
        privateKey: privateKey?.startsWith('0x') ? privateKey : `0x${privateKey}`,
        walletAddress: accountAddress,
        testnet: false,
    } as any);
  }

  private fromExchangeSymbol(sym: string): string { return sym; }
  private toExchangeSymbol(sym: string): string {
    let s = sym.toUpperCase();
    if (s.endsWith('-PERP')) return s.replace('-PERP', '');
    if (s.endsWith('USDT')) return s.replace('USDT', '');
    return s;
  }

  // Precision Helper
  private formatByDecimals(value: string | number, decimals: number): string {
      return parseFloat(value.toString()).toFixed(decimals);
  }
  
  private formatPrice(price: number): number {
      // Hyperliquid uses 5 significant figures for price
      return parseFloat(price.toPrecision(5));
  }

  private async getAssetMeta(symbol: string): Promise<{ decimals: number }> {
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      const s = this.toExchangeSymbol(symbol);
      const asset = meta.universe.find((u: any) => u.name === s);
      return { decimals: asset ? asset.szDecimals : 3 };
  }

  async getAccount(): Promise<AccountInfo> {
    try {
      const state = await this.sdk.info.perpetuals.getClearinghouseState(this.accountAddress);
      
      const activePositions = state.assetPositions
          .filter((p: any) => parseFloat(p.position.szi) !== 0) 
          .map((p: any) => ({
            symbol: this.fromExchangeSymbol(p.position.coin),
            size: p.position.szi,
            entryPrice: p.position.entryPx,
            markPrice: p.position.positionValue,
            unrealizedPnl: p.position.unrealizedPnl,
            side: parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT',
            leverage: p.position.leverage.value.toString(),
            liquidationPrice: p.position.liquidationPx
          }));

      return {
        exchange: 'hyperliquid',
        totalBalance: String(state.marginSummary.accountValue || '0'),
        availableBalance: String(state.withdrawable || '0'),
        positions: activePositions,
        timestamp: Date.now()
      };
    } catch (error: any) {
       if (error.toString().includes('Failed to deserialize')) {
           return { exchange: 'hyperliquid', totalBalance: '0', availableBalance: '0', positions: [], timestamp: Date.now() };
       }
       throw new Error(`Failed to fetch Hyperliquid account: ${error}`);
    }
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    try {
      // @ts-ignore
      if (!this.sdk.isWebSocketConnected || !this.sdk.isWebSocketConnected()) {
        await this.sdk.connect();
      }

      const isBuy = params.side === 'BUY';
      const symbol = this.toExchangeSymbol(params.symbol);
      
      // 1. Fetch Precision
      const { decimals } = await this.getAssetMeta(symbol);
      const fmtQty = this.formatByDecimals(params.quantity, decimals);

      let orderType: any = { limit: { tif: 'Gtc' } };
      let limitPrice = parseFloat(params.price || '0');

      if (params.type === 'MARKET') {
        // @ts-ignore
        const mids = await this.sdk.info.getAllMids();
        const currentPrice = parseFloat(mids[symbol] || '0');
        if (!currentPrice) throw new Error(`Cannot determine market price for ${symbol}`);

        const aggressive = isBuy ? currentPrice * 1.05 : currentPrice * 0.95;
        limitPrice = this.formatPrice(aggressive);
        orderType = { limit: { tif: 'Ioc' } }; 

      } else if (params.type === 'LIMIT') {
          if (!params.price) throw new Error('LIMIT order requires price');
          limitPrice = this.formatPrice(parseFloat(params.price));
      } else {
          // Trigger logic simplified for overwrite
          if (params.type.includes('STOP') || params.type.includes('TAKE_PROFIT')) {
               if (!params.triggerPrice) throw new Error('Trigger price required');
               const triggerPx = this.formatPrice(parseFloat(params.triggerPrice));
               const isMarket = params.type.includes('MARKET');
               
               orderType = {
                  trigger: {
                    triggerPx: triggerPx.toString(),
                    isMarket,
                    tpsl: params.type.includes('STOP') ? 'sl' : 'tp'
                  }
               };
               limitPrice = triggerPx; 
          }
      }

      // @ts-ignore
      const result = await this.sdk.exchange.placeOrder({
        coin: symbol,
        is_buy: isBuy,
        sz: parseFloat(fmtQty), // Send parsed float of formatted string
        limit_px: limitPrice,
        order_type: orderType,
        reduce_only: !!params.reduceOnly
      });

      if (result.status === 'err') throw new Error(`Order failed: ${result.response}`);

      const statuses = result.response?.data?.statuses || [];
      const firstError = statuses.find((s: any) => s.error);
      if (firstError) throw new Error(`Order rejected: ${firstError.error}`);

      const firstStatus = statuses[0];
      const oid = firstStatus?.resting?.oid || (firstStatus?.filled ? (firstStatus.filled.oid || Date.now()) : Date.now());
      const status = firstStatus?.filled ? 'FILLED' : 'NEW';

      return {
        orderId: String(oid),
        symbol,
        side: params.side,
        type: params.type,
        quantity: fmtQty,
        price: params.price || limitPrice.toString(),
        status: status as any,
        timestamp: Date.now()
      };
    } catch (error) { throw new Error(`Failed to place Hyperliquid order: ${error}`); }
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<CancelResult> {
    if (!symbol) throw new Error("Symbol required");
    try {
      // @ts-ignore
      await this.sdk.exchange.cancelOrder({ coin: this.toExchangeSymbol(symbol), o: parseInt(orderId) });
      return { orderId, symbol, status: 'CANCELED', message: 'Canceled' };
    } catch (error) { return { orderId, symbol, status: 'FAILED', message: `Failed: ${error}` }; }
  }

  async cancelAllOrders(symbol?: string): Promise<{ success: boolean; canceledCount: number; message: string }> {
      try {
        const orders = await this.getOpenOrders(symbol);
        if(!orders.length) return { success: true, canceledCount: 0, message: 'No orders' };
        await Promise.all(orders.map(o => this.cancelOrder(o.orderId, o.symbol)));
        return { success: true, canceledCount: orders.length, message: `Cancelled ${orders.length} orders` };
      } catch (e: any) { return { success: false, canceledCount: 0, message: e.message }; }
  }

  async setLeverage(symbol: string, leverage: number): Promise<{ success: boolean; message?: string }> {
      try {
        const s = this.toExchangeSymbol(symbol);
        // @ts-ignore
        await this.sdk.exchange.updateLeverage(s, "cross", leverage);
        return { success: true, message: `Leverage ${leverage}x` };
      } catch (e: any) { return { success: false, message: e.message }; }
  }

  async setMarginMode(symbol: string, mode: 'CROSS' | 'ISOLATED'): Promise<{ success: boolean; message?: string }> {
       try {
           const s = this.toExchangeSymbol(symbol);
           // @ts-ignore
           await this.sdk.exchange.updateLeverage(s, mode === 'CROSS' ? 'cross' : 'isolated', 10);
           return { success: true, message: `Mode ${mode} set` };
       } catch (e: any) { return { success: false, message: e.message }; }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      // @ts-ignore
      const orders = await this.sdk.info.getUserOpenOrders(this.accountAddress);
      let filtered = orders;
      if (symbol) {
          const s = this.toExchangeSymbol(symbol);
          filtered = orders.filter((o: any) => o.coin === s);
      }
      return filtered.map((o: any) => ({
        orderId: String(o.oid), symbol: o.coin, side: o.side === 'B' ? 'BUY' : 'SELL',
        type: 'LIMIT', quantity: o.sz, price: o.limitPx, filled: '0', status: 'NEW', timestamp: o.timestamp
      }));
    } catch (e) { return []; }
  }

  async getOrderHistory(symbol?: string, limit?: number): Promise<Order[]> { return []; }

  async getPositions(symbol?: string): Promise<Position[]> {
    const acc = await this.getAccount();
    if (symbol) return acc.positions.filter(p => p.symbol === symbol || p.symbol === this.toExchangeSymbol(symbol));
    return acc.positions;
  }

  async getOrderbook(symbol: string, depth = 20): Promise<Orderbook> {
      // @ts-ignore
      const book = await this.sdk.info.getL2Book(this.toExchangeSymbol(symbol));
      return {
          symbol, bids: book.levels[0].slice(0, depth).map((b: any) => [b.px, b.sz]),
          asks: book.levels[1].slice(0, depth).map((a: any) => [a.px, a.sz]), timestamp: Date.now()
      };
  }

  async getTicker(symbol: string): Promise<Ticker> {
      // @ts-ignore
      const mids = await this.sdk.info.getAllMids(); 
      const s = this.toExchangeSymbol(symbol); 
      const price = mids[s];
      if (!price) throw new Error(`Symbol ${s} not found`);
      return { symbol, price: price, change24h: '0', volume24h: '0', high24h: '0', low24h: '0', timestamp: Date.now() };
  }

  async getAssets(): Promise<Asset[]> {
      // @ts-ignore
      const meta = await this.sdk.info.perpetuals.getMeta();
      return meta.universe.map((a: any) => ({
          symbol: a.name, name: a.name, baseAsset: a.name, quoteAsset: 'USD', minQuantity: '0.001',
          tickSize: String(Math.pow(10, -a.szDecimals))
      }));
  }

  async getFills(): Promise<any[]> { return []; }
  async getOHLCV(): Promise<any[]> { return []; }
  async closePosition(): Promise<any> { throw new Error("Not Implemented"); }
  async setPositionTPSL(): Promise<any> { throw new Error("Not Implemented"); }
  async updatePositionMargin(): Promise<any> { throw new Error("Not Implemented"); }
}
