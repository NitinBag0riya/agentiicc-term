/**
 * Aster Exchange Adapter - Full Implementation
 */

import type {
  ExchangeAdapter, AccountInfo, PlaceOrderParams, OrderResult,
  CancelResult, Order, Position, Orderbook, Ticker, Asset
} from './base.adapter';
import { createHmac } from 'crypto';

export class AsterAdapter implements ExchangeAdapter {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl = 'https://fapi.asterdex.com';

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private sign(queryString: string): string {
    return createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async request(endpoint: string, params: Record<string, any> = {}, method: 'GET' | 'POST' | 'DELETE' = 'GET') {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = new URLSearchParams(queryParams as any).toString();
    const signature = this.sign(queryString);
    
    const url = `${this.baseUrl}${endpoint}?${queryString}&signature=${signature}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aster API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async getAccount(): Promise<AccountInfo> {
    try {
      const data: any = await this.request('/fapi/v1/account');

      return {
        exchange: 'aster',
        totalBalance: data.totalWalletBalance || '0',
        availableBalance: data.availableBalance || '0',
        positions: data.positions?.map((p: any) => ({
          symbol: p.symbol,
          size: p.positionAmt,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unRealizedProfit,
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          leverage: p.leverage,
          liquidationPrice: p.liquidationPrice
        })) || [],
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to fetch Aster account: ${error}`);
    }
  }

  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    try {
      const orderParams: any = {
        symbol: params.symbol,
        side: params.side,
        type: params.type === 'STOP_LIMIT' ? 'STOP' : 
              params.type === 'TAKE_PROFIT_LIMIT' ? 'TAKE_PROFIT' : 
              params.type,
        quantity: params.quantity
      };

      if (params.type === 'STOP_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
          // For Stop Limit, 'price' is the execution price (limit price)
          // We prefer stopLimitPrice if available, otherwise fall back to price
          if (params.stopLimitPrice) {
              orderParams.price = params.stopLimitPrice;
          } else if (params.price) {
              orderParams.price = params.price;
          }
      } else if (params.price) {
        orderParams.price = params.price;
      }
      
      if (params.type === 'OCO') {
          throw new Error('OCO orders are not supported by Aster adapter yet.');
      }
      
      // Map Trigger Price -> stopPrice
      if (params.triggerPrice) {
          orderParams.stopPrice = params.triggerPrice;
      }

      // Map Trailing Delta -> callbackRate
      if (params.trailingDelta) {
          orderParams.callbackRate = params.trailingDelta;
      }

      // TimeInForce Handling
      if (params.timeInForce) {
          orderParams.timeInForce = params.timeInForce;
      } else if (params.type === 'LIMIT' || params.type === 'STOP_LIMIT' || params.type === 'TAKE_PROFIT_LIMIT') {
           // Default to GTC for limit-like orders if not specified
          orderParams.timeInForce = 'GTC';
      }

      // PostOnly -> GTX
      if (params.postOnly) {
          orderParams.timeInForce = 'GTX';
      }
      
      if (params.reduceOnly) orderParams.reduceOnly = 'true';
      if (params.leverage) orderParams.leverage = params.leverage;

      // 1. Set Leverage if needed
      if (params.leverage) {
          try {
              await this.request('/fapi/v1/leverage', {
                  symbol: params.symbol,
                  leverage: params.leverage
              }, 'POST');
          } catch (e: any) {
              console.warn(`Warning: Failed to set leverage: ${e.message}`);
          }
      }

      // 2. Place Main Order
      const data: any = await this.request('/fapi/v1/order', orderParams, 'POST');
      
      // 3. Place TP/SL Orders if provided (Strategy Attachment)
      if (data.orderId && (params.takeProfit || params.stopLoss)) {
          const childSide = params.side === 'BUY' ? 'SELL' : 'BUY';
          const qty = params.quantity; // We assume full close for simple attachment

          // Take Profit
          if (params.takeProfit) {
              this.placeConditionalOrder(params.symbol, childSide, 'TAKE_PROFIT_MARKET', params.takeProfit, qty)
                  .then(() => console.log('   ✅ Attached TP placed'))
                  .catch(e => console.warn(`   ⚠️ Failed to attach TP: ${e.message}`));
          }

          // Stop Loss
          if (params.stopLoss) {
              this.placeConditionalOrder(params.symbol, childSide, 'STOP_MARKET', params.stopLoss, qty)
                  .then(() => console.log('   ✅ Attached SL placed'))
                  .catch(e => console.warn(`   ⚠️ Failed to attach SL: ${e.message}`));
          }
      }

      return {
        orderId: data.orderId || data.order_id || String(data.id),
        symbol: data.symbol,
        side: data.side,
        type: data.type as any, // Cast to match generic type
        quantity: data.origQty || data.quantity,
        price: data.price,
        status: data.status,
        timestamp: data.updateTime || Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to place Aster order: ${error}`);
    }
  }

  // Helper for placing conditional orders (TP/SL)
  private async placeConditionalOrder(symbol: string, side: 'BUY'|'SELL', type: string, stopPrice: string, quantity: string) {
      return this.request('/fapi/v1/order', {
          symbol,
          side,
          type,
          stopPrice,
          quantity,
          timeInForce: 'GTC',
          reduceOnly: 'true'
      }, 'POST');
  }

  async cancelOrder(orderId: string, symbol?: string): Promise<CancelResult> {
    try {
      const params: any = { orderId };
      if (symbol) params.symbol = symbol;

      const data: any = await this.request('/fapi/v1/order', params, 'DELETE');

      return {
        orderId: data.orderId || orderId,
        symbol: data.symbol,
        status: 'CANCELED',
        message: 'Order canceled successfully'
      };
    } catch (error) {
      return {
        orderId,
        symbol: symbol || '',
        status: 'FAILED',
        message: `Failed to cancel order: ${error}`
      };
    }
  }
  
  async cancelAllOrders(symbol?: string): Promise<{ success: boolean; canceledCount: number; message: string }> {
    if (!symbol) {
        return { success: false, canceledCount: 0, message: 'Symbol is required to cancel all orders' };
    }
    
    try {
        const data: any = await this.request('/fapi/v1/allOpenOrders', { symbol }, 'DELETE');
        // Aster API returns { code: 200, msg: "success" } on success
        return {
            success: true,
            canceledCount: -1, // Unknown count from API
            message: 'All open orders canceled successfully'
        };
    } catch (error: any) {
        return {
            success: false,
            canceledCount: 0,
            message: `Failed to cancel all orders: ${error.message}`
        };
    }
  }

  /**
   * Set leverage for a symbol
   */
  async setLeverage(symbol: string, leverage: number): Promise<{ success: boolean; message?: string }> {
    try {
      await this.request('/fapi/v1/leverage', {
        symbol,
        leverage
      }, 'POST');

      return {
        success: true,
        message: `Leverage set to ${leverage}x for ${symbol}`
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
   */
  async setMarginMode(symbol: string, mode: 'CROSS' | 'ISOLATED'): Promise<{ success: boolean; message?: string }> {
    try {
      // Binance Futures API expects 'CROSSED' or 'ISOLATED' (uppercase)
      const marginType = mode === 'CROSS' ? 'CROSSED' : 'ISOLATED';
      
      await this.request('/fapi/v1/marginType', {
        symbol,
        marginType: marginType
      }, 'POST');

      return {
        success: true,
        message: `Margin mode set to ${mode} for ${symbol}`
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
   */
  async getMarginMode(symbol: string): Promise<'CROSS' | 'ISOLATED'> {
    try {
      const positions: any = await this.request('/fapi/v1/positionRisk');
      const position = positions.find((p: any) => p.symbol === symbol);
      
      return position?.marginType === 'isolated' ? 'ISOLATED' : 'CROSS';
    } catch (error) {
      // Default to CROSS if unable to determine
      return 'CROSS';
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const params: any = {};
      if (symbol) params.symbol = symbol;

      const data: any = await this.request('/fapi/v1/openOrders', params);
      const orders = Array.isArray(data) ? data : [];

      return orders.map((o: any) => ({
        orderId: String(o.orderId || o.id),
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.origQty,
        price: o.price,
        filled: o.executedQty || '0',
        status: o.status,
        timestamp: o.time || o.updateTime
      }));
    } catch (error) {
      throw new Error(`Failed to fetch open orders: ${error}`);
    }
  }

  async getOrderHistory(symbol?: string, limit: number = 50): Promise<Order[]> {
    try {
      const params: any = { limit };
      if (symbol) params.symbol = symbol;

      const data: any = await this.request('/fapi/v1/allOrders', params);
      const orders = Array.isArray(data) ? data : [];

      return orders.map((o: any) => ({
        orderId: String(o.orderId || o.id),
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.origQty,
        price: o.price,
        filled: o.executedQty || '0',
        status: o.status,
        timestamp: o.time || o.updateTime
      }));
    } catch (error) {
      throw new Error(`Failed to fetch order history: ${error}`);
    }
  }

  async getPositions(symbol?: string): Promise<Position[]> {
    try {
      const data: any = await this.request('/fapi/v1/positionRisk');
      const positions = Array.isArray(data) ? data : [];

      return positions
        .filter((p: any) => !symbol || p.symbol === symbol)
        .filter((p: any) => parseFloat(p.positionAmt) !== 0)
        .map((p: any) => ({
          symbol: p.symbol,
          size: p.positionAmt,
          entryPrice: p.entryPrice,
          markPrice: p.markPrice,
          unrealizedPnl: p.unRealizedProfit,
          side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
          leverage: p.leverage,
          liquidationPrice: p.liquidationPrice
        }));
    } catch (error) {
      throw new Error(`Failed to fetch positions: ${error}`);
    }
  }

  async getOrderbook(symbol: string, depth: number = 20): Promise<Orderbook> {
    try {
      // Orderbook doesn't need signing
      const url = `${this.baseUrl}/fapi/v1/depth?symbol=${symbol}&limit=${depth}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orderbook: ${response.status}`);
      }

      const data: any = await response.json();

      return {
        symbol,
        bids: data.bids || [],
        asks: data.asks || [],
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to fetch orderbook: ${error}`);
    }
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const url = `${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${symbol}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ticker: ${response.status}`);
      }

      const data: any = await response.json();

      return {
        symbol: data.symbol,
        price: data.lastPrice,
        change24h: data.priceChangePercent,
        volume24h: data.volume,
        high24h: data.highPrice,
        low24h: data.lowPrice,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to fetch ticker: ${error}`);
    }
  }

  async getAssets(): Promise<Asset[]> {
    try {
      const url = `${this.baseUrl}/fapi/v1/exchangeInfo`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.status}`);
      }

      const data: any = await response.json();
      const symbols = data.symbols || [];

      return symbols.map((s: any) => ({
        symbol: s.symbol,
        name: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        minQuantity: s.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.minQty,
        maxQuantity: s.filters?.find((f: any) => f.filterType === 'LOT_SIZE')?.maxQty,
        tickSize: s.filters?.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize
      }));
    } catch (error) {
      throw new Error(`Failed to fetch assets: ${error}`);
    }
  }

  async getFills(symbol?: string, limit: number = 50): Promise<any[]> {
    try {
      const params: any = { limit };
      if (symbol) params.symbol = symbol;

      const data: any = await this.request('/fapi/v1/userTrades', params);
      const trades = Array.isArray(data) ? data : [];

      return trades.map((t: any) => ({
        orderId: String(t.orderId),
        symbol: t.symbol,
        side: t.side,
        price: t.price,
        quantity: t.qty,
        fee: t.commission,
        feeCurrency: t.commissionAsset,
        timestamp: t.time
      }));
    } catch (error) {
      throw new Error(`Failed to fetch fills: ${error}`);
    }
  }

  async closePosition(symbol: string): Promise<OrderResult> {
    try {
      // 1. Get current position details
      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol);

      if (!position || parseFloat(position.size) === 0) {
        throw new Error(`No open position found for ${symbol}`);
      }

      // 2. Determine side and quantity to close
      const size = parseFloat(position.size);
      const side = size > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(size).toString();

      // 3. Place Market Order to Close
      return await this.placeOrder({
        symbol,
        side,
        type: 'MARKET',
        quantity,
        models: undefined, // Fix for strict typing
        reduceOnly: true
      } as any);

    } catch (error) {
      throw new Error(`Failed to close position: ${error}`);
    }
  }

  async setPositionTPSL(symbol: string, tpPrice?: string, slPrice?: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Cancel existing open orders (strategy: cancel all or specific triggers? For simplicity, we might assume user wants to reset TP/SL)
      // Better: Cancel only existing TP/SL triggers if possible, but identifying them is hard without client-side tracking.
      // We will blindly place new ones as per interface. User should cancel manually if they want to replace.
      // Optionally, we could search for existing TP/SL and cancel them.

      const positions = await this.getPositions(symbol);
      const position = positions.find(p => p.symbol === symbol);
      if (!position || parseFloat(position.size) === 0) throw new Error('No open position');

      const isLong = position.side === 'LONG';
      const side = isLong ? 'SELL' : 'BUY';
      const quantity = Math.abs(parseFloat(position.size)).toString();

      const results = [];

      // Place Take Profit
      if (tpPrice) {
        const tpRes = await this.placeConditionalOrder(symbol, side, 'TAKE_PROFIT_MARKET', tpPrice, quantity);
        results.push('TP Placed');
      }

      // Place Stop Loss
      if (slPrice) {
        const slRes = await this.placeConditionalOrder(symbol, side, 'STOP_MARKET', slPrice, quantity);
        results.push('SL Placed');
      }

      return {
        success: true,
        message: `Set TP/SL for ${symbol}: ${results.join(', ')}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to set TP/SL: ${error.message}`
      };
    }
  }

  async updatePositionMargin(symbol: string, amount: string, type: 'ADD' | 'REMOVE'): Promise<{ success: boolean; message: string }> {
    try {
      const typeInt = type === 'ADD' ? 1 : 2;
      
      await this.request('/fapi/v1/positionMargin', {
        symbol,
        amount,
        type: typeInt
      }, 'POST');

      return {
        success: true,
        message: `Successfully ${type === 'ADD' ? 'added' : 'removed'} ${amount} margin for ${symbol}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to update margin: ${error.message}`
      };
    }
  }

  async getOHLCV(symbol: string, timeframe: string, limit: number = 200): Promise<any[]> {
    try {
       // Valid intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
       const url = `${this.baseUrl}/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=${limit}`;
       const response = await fetch(url);
       const data: any = await response.json();

       // [time, open, high, low, close, volume, closeTime, quoteAssetVolume, trades, takerBuyBase, takerBuyQuote, ignore]
       return data.map((k: any[]) => ({
         timestamp: k[0],
         open: k[1],
         high: k[2],
         low: k[3],
         close: k[4],
         volume: k[5]
       }));
    } catch (error) {
      throw new Error(`Failed to fetch OHLCV: ${error}`);
    }
  }
}
