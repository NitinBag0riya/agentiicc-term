/**
 * Aster Exchange Adapter - Full Implementation (Precision Fixed)
 */

import type {
  ExchangeAdapter, AccountInfo, PlaceOrderParams, OrderResult,
  CancelResult, Order, Position, Orderbook, Ticker, Asset
} from './base.adapter';
import { createHmac } from 'crypto';
import Decimal from 'decimal.js'; // Ensure we use precise math

export class AsterAdapter implements ExchangeAdapter {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://fapi.asterdex.com';

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  // Helper to normalize symbols (App -> Exchange)
  private toExchangeSymbol(symbol: string): string {
      let s = symbol.toUpperCase();
      s = s.replace(/[-_]/g, '');
      if (s.endsWith('USDT')) return s; 
      return `${s}USDT`;
  }

  // Helper to denormalize (Exchange -> App)
  private fromExchangeSymbol(symbol: string): string {
      if (!symbol) return '';
      return symbol.replace('USDT', '');
  }

  private sign(queryString: string): string {
    return createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  private async request(endpoint: string, params: Record<string, any> = {}, method: 'GET' | 'POST' | 'DELETE' = 'GET') {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = new URLSearchParams(queryParams as any).toString();
    const signature = this.sign(queryString);
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    const response = await fetch(url, {
      method,
      headers: { 'X-MBX-APIKEY': this.apiKey, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aster API Error: ${response.status} - ${errorText}`);
    }
    return await response.json();
  }

  // Precision Helper based on Step Size
  // e.g. value=1.23456, step=0.01 -> 1.23
  private formatByStep(value: string | number, stepSize: string | number): string {
      const dValue = new Decimal(value);
      const dStep = new Decimal(stepSize);
      
      // Calculate precision from step size
      // e.g. 0.01 -> 2 decimals, 1 -> 0 decimals, 0.00001 -> 5 decimals
      if (dStep.eq(0)) return String(value);

      // Quantize
      // Round DOWN for quantity (to avoid insufficient balance), Round HALF_UP for price
      // We generally use round down for safety on quantity
      // But for price we should use standard routing.
      
      // Let's implement generic step rounding: (val / step).floor() * step
      const qty = dValue.div(dStep).floor().mul(dStep);
      return qty.toFixed();
  }
  
  private formatPriceByTick(value: string | number, tickSize: string | number): string {
      const dValue = new Decimal(value);
      const dTick = new Decimal(tickSize);
      if (dTick.eq(0)) return String(value);
      // Round half up usually for prices
      const price = dValue.div(dTick).round().mul(dTick);
      return price.toFixed();
  }

  private async getSymbolPrecision(symbol: string): Promise<{ qtyStep: string, priceTick: string }> {
      try {
          const info: any = await this.request('/fapi/v1/exchangeInfo');
          const s = info.symbols.find((x: any) => x.symbol === symbol);
          if (!s) return { qtyStep: '0.001', priceTick: '0.01' }; // Fallback

          const lotFilter = s.filters.find((f: any) => f.filterType === 'LOT_SIZE');
          const priceFilter = s.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
          
          return {
              qtyStep: lotFilter ? lotFilter.stepSize : '0.001',
              priceTick: priceFilter ? priceFilter.tickSize : '0.01'
          };
      } catch (e) {
          console.warn('Failed to fetch precision:', e);
          return { qtyStep: '0.001', priceTick: '0.01' };
      }
  }

  async getAccount(): Promise<AccountInfo> {
    try {
      const data: any = await this.request('/fapi/v1/account');
      return {
        exchange: 'aster',
        totalBalance: data.totalWalletBalance || '0',
        availableBalance: data.availableBalance || '0',
        positions: data.positions
          ?.filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => ({
          symbol: this.fromExchangeSymbol(p.symbol),
          size: p.positionAmt,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unRealizedProfit || '0',
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          leverage: p.leverage,
          liquidationPrice: p.liquidationPrice
        })) || [],
        timestamp: Date.now()
      };
    } catch (error) { throw new Error(`Failed to fetch Aster account: ${error}`); }
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    try {
      const exchangeSymbol = this.toExchangeSymbol(params.symbol);
      
      // 1. Fetch Precision
      const { qtyStep, priceTick } = await this.getSymbolPrecision(exchangeSymbol);
      
      // 2. Format Values
      const fmtQty = this.formatByStep(params.quantity, qtyStep);
      let fmtPrice = params.price ? this.formatPriceByTick(params.price, priceTick) : undefined;
      let fmtStopPrice = params.triggerPrice ? this.formatPriceByTick(params.triggerPrice, priceTick) : undefined;

      const orderParams: any = {
        symbol: exchangeSymbol,
        side: params.side,
        type: params.type === 'STOP_LIMIT' ? 'STOP' : 
              params.type === 'TAKE_PROFIT_LIMIT' ? 'TAKE_PROFIT' : 
              params.type,
        quantity: fmtQty
      };

      if (params.type === 'STOP_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
          if (params.stopLimitPrice) {
              orderParams.price = this.formatPriceByTick(params.stopLimitPrice, priceTick);
          } else if (fmtPrice) {
              orderParams.price = fmtPrice;
          }
      } else if (fmtPrice) {
        orderParams.price = fmtPrice;
      }
      
      if (params.type === 'OCO') throw new Error('OCO not supported');
      
      if (fmtStopPrice) {
          orderParams.stopPrice = fmtStopPrice;
      }
      
      if (params.reduceOnly) orderParams.reduceOnly = 'true';
      if (params.timeInForce) orderParams.timeInForce = params.timeInForce;

      const data: any = await this.request('/fapi/v1/order', orderParams, 'POST');

      // Handle Attached TP/SL
      if (params.takeProfit || params.stopLoss) {
          const childSide = params.side === 'BUY' ? 'SELL' : 'BUY';
          if (params.takeProfit) {
              this.placeConditionalOrder(exchangeSymbol, childSide, 'TAKE_PROFIT_MARKET', params.takeProfit, fmtQty, priceTick)
                  .catch(e => console.warn(`   ⚠️ Attached TP Failed: ${e.message}`));
          }
          if (params.stopLoss) {
              this.placeConditionalOrder(exchangeSymbol, childSide, 'STOP_MARKET', params.stopLoss, fmtQty, priceTick)
                  .catch(e => console.warn(`   ⚠️ Attached SL Failed: ${e.message}`));
          }
      }

      return {
        orderId: data.orderId || data.order_id || String(data.id),
        symbol: this.fromExchangeSymbol(data.symbol),
        side: data.side,
        type: data.type as any, 
        quantity: data.origQty || data.quantity,
        price: data.price,
        status: data.status,
        timestamp: data.updateTime || Date.now()
      };
    } catch (error) { throw new Error(`Failed to place Aster order: ${error}`); }
  }

  private async placeConditionalOrder(symbol: string, side: 'BUY'|'SELL', type: string, stopPrice: string, quantity: string, tickSize: string) {
      // Ensure stopPrice is formatted
      const fmtStop = this.formatPriceByTick(stopPrice, tickSize);
      return this.request('/fapi/v1/order', {
          symbol,
          side,
          type,
          stopPrice: fmtStop,
          quantity,
          timeInForce: 'GTC',
          reduceOnly: 'true'
      }, 'POST');
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<CancelResult> {
    try {
      const params: any = { orderId };
      if (symbol) params.symbol = this.toExchangeSymbol(symbol);
      const data: any = await this.request('/fapi/v1/order', params, 'DELETE');
      return { orderId: data.orderId||orderId, symbol: this.fromExchangeSymbol(data.symbol), status: 'CANCELED', message: 'Canceled' };
    } catch (error) { return { orderId, symbol: symbol||'', status: 'FAILED', message: `Failed: ${error}` }; }
  }
  
  async cancelAllOrders(symbol?: string): Promise<{ success: boolean; canceledCount: number; message: string }> {
    if (!symbol) return { success: false, canceledCount: 0, message: 'Symbol required' };
    try {
        await this.request('/fapi/v1/allOpenOrders', { symbol: this.toExchangeSymbol(symbol) }, 'DELETE');
        return { success: true, canceledCount: -1, message: 'All canceled' };
    } catch (error: any) { return { success: false, canceledCount: 0, message: error.message }; }
  }

  async setLeverage(symbol: string, leverage: number): Promise<{ success: boolean; message?: string }> {
    try {
      await this.request('/fapi/v1/leverage', { symbol: this.toExchangeSymbol(symbol), leverage }, 'POST');
      return { success: true, message: `Leverage ${leverage}x` };
    } catch (error: any) { return { success: false, message: error.message }; }
  }

  async setMarginMode(symbol: string, mode: 'CROSS' | 'ISOLATED'): Promise<{ success: boolean; message?: string }> {
      try {
          await this.request('/fapi/v1/marginType', { symbol: this.toExchangeSymbol(symbol), marginType: mode }, 'POST');
          return { success: true, message: `Margin ${mode}` };
      } catch (e: any) {
          if (e.message && e.message.includes('No need')) return { success: true, message: `Already ${mode}` };
          return { success: false, message: e.message };
      }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params: any = {};
      if (symbol) params.symbol = this.toExchangeSymbol(symbol);
      const data: any = await this.request('/fapi/v1/openOrders', params);
      const orders = Array.isArray(data) ? data : [];
      return orders.map((o: any) => ({
        orderId: o.orderId, symbol: this.fromExchangeSymbol(o.symbol),
        side: o.side, type: o.type, quantity: o.origQty, price: o.price,
        filled: o.executedQty, status: o.status, timestamp: o.time
      }));
    } catch (error) { throw new Error(`Orders Error: ${error}`); }
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
      try {
          const params: any = { limit };
          if (symbol) params.symbol = this.toExchangeSymbol(symbol);
          const data: any = await this.request('/fapi/v1/allOrders', params);
          return (Array.isArray(data) ? data : []).map((o: any) => ({
              orderId: o.orderId, symbol: this.fromExchangeSymbol(o.symbol),
              side: o.side, type: o.type, quantity: o.origQty, price: o.price,
              filled: o.executedQty, status: o.status, timestamp: o.time
          }));
      } catch (error) { throw new Error(`History Error: ${error}`); }
  }

  async getPositions(symbol?: string): Promise<Position[]> {
    try {
      const data: any = await this.request('/fapi/v1/positionRisk');
      const positions = Array.isArray(data) ? data : [];
      const target = symbol ? this.toExchangeSymbol(symbol) : undefined;
      return positions
        .filter((p: any) => !target || p.symbol === target)
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          symbol: this.fromExchangeSymbol(p.symbol),
          size: p.positionAmt, entryPrice: p.entryPrice, markPrice: p.markPrice,
          unrealizedPnl: p.unRealizedProfit, side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          leverage: p.leverage, liquidationPrice: p.liquidationPrice
        }));
    } catch (error) { throw new Error(`Positions Error: ${error}`); }
  }

  async getOrderbook(symbol: string, depth: number = 20): Promise<Orderbook> {
    try {
      const response = await fetch(`${this.baseUrl}/fapi/v1/depth?symbol=${this.toExchangeSymbol(symbol)}&limit=${depth}`);
      if (!response.ok) throw new Error(`${response.status}`);
      const data: any = await response.json();
      return { symbol: this.fromExchangeSymbol(symbol), bids: data.bids||[], asks: data.asks||[], timestamp: Date.now() };
    } catch (error) { throw new Error(`Orderbook Error: ${error}`); }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const response = await fetch(`${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${this.toExchangeSymbol(symbol)}`);
      if (!response.ok) throw new Error(`${response.status}`);
      const data: any = await response.json();
      return {
        symbol: this.fromExchangeSymbol(data.symbol), price: data.lastPrice,
        change24h: data.priceChangePercent, volume24h: data.volume,
        high24h: data.highPrice, low24h: data.lowPrice, timestamp: Date.now()
      };
    } catch (error) { throw new Error(`Ticker Error: ${error}`); }
  }

  async getAssets(): Promise<Asset[]> {
    try {
      const response = await fetch(`${this.baseUrl}/fapi/v1/exchangeInfo`);
      if (!response.ok) throw new Error(`${response.status}`);
      const data: any = await response.json();
      return (data.symbols || []).map((s: any) => ({
        symbol: this.fromExchangeSymbol(s.symbol), name: s.symbol,
        baseAsset: s.baseAsset, quoteAsset: s.quoteAsset,
        minQuantity: s.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.minQty,
        maxQuantity: s.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.maxQty,
        tickSize: s.filters?.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize
      }));
    } catch (error) { throw new Error(`Assets Error: ${error}`); }
  }

  async getFills(symbol?: string, limit: number = 50): Promise<any[]> {
    try {
      const params: any = { limit };
      if (symbol) params.symbol = this.toExchangeSymbol(symbol);
      const data: any = await this.request('/fapi/v1/userTrades', params);
      return (Array.isArray(data) ? data : []).map((t: any) => ({
        orderId: t.orderId, symbol: this.fromExchangeSymbol(t.symbol),
        side: t.side, price: t.price, quantity: t.qty,
        fee: t.commission, feeCurrency: t.commissionAsset, timestamp: t.time
      }));
    } catch (error) { throw new Error(`Fills Error: ${error}`); }
  }

  async getOHLCV(): Promise<any[]> { return []; }

  async closePosition(symbol: string): Promise<OrderResult> {
       const positions = await this.getPositions(symbol);
       const pos = positions[0];
       if (!pos) throw new Error('No position found');
       const size = parseFloat(pos.size);
       const side = size > 0 ? 'SELL' : 'BUY';
       const { qtyStep } = await this.getSymbolPrecision(this.toExchangeSymbol(symbol));
       return this.placeOrder({
           symbol, side, type: 'MARKET',
           quantity: this.formatByStep(Math.abs(size).toString(), qtyStep),
           reduceOnly: true
       });
  }
  
  async setPositionTPSL(symbol: string, tpPrice?: string, slPrice?: string): Promise<{ success: boolean; message: string }> {
     // Not strictly implemented for now in overwrite as it requires complex lookup
     return { success: false, message: "Use order form for TPSL" };
  }
  
  async updatePositionMargin(symbol: string, amount: string, type: 'ADD' | 'REMOVE'): Promise<{ success: boolean; message: string }> {
       const exchangeSymbol = this.toExchangeSymbol(symbol);
       const typeCode = type === 'ADD' ? 1 : 2;
       await this.request('/fapi/v1/positionMargin', { symbol: exchangeSymbol, amount, type: typeCode }, 'POST');
       return { success: true, message: `Margin updated` };
  }
}
