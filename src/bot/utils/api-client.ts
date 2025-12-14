/**
 * Universal API Client Wrapper
 */

import { BOT_CONFIG } from '../config';

export class UniversalApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(token?: string) {
    this.baseUrl = BOT_CONFIG.apiBaseUrl;
    this.token = token;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      console.log(`[API Client] ${method} ${url}`);
      console.log(`[API Client] Headers:`, headers);
      if (body) console.log(`[API Client] Body:`, body);
      
      const response = await fetch(url, options);
      
      console.log(`[API Client] Response status:`, response.status);
      console.log(`[API Client] Response headers:`, Object.fromEntries(response.headers.entries()));

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`[API Client] Non-JSON response:`, text.substring(0, 200));
        throw new Error(`API server returned non-JSON response (${response.status}). Is the server running?`);
      }

      const data = await response.json();
      console.log(`[API Client] Response data:`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[API Client] ${method} ${path} failed:`, errorMessage);
      
      // Provide more helpful error messages
      if (errorMessage.includes('fetch failed') || (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNREFUSED')) {
        throw new Error(`Cannot connect to API server at ${this.baseUrl}. Please ensure the server is running.`);
      }
      
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  // ============ AUTH ============

  async createSession(userId: number, exchangeId: string): Promise<string> {
    const data = await this.request('POST', '/auth/session', { userId, exchangeId });
    return data.token;
  }

  async deleteSession(): Promise<void> {
    await this.request('DELETE', '/auth/session');
  }

  // ============ ACCOUNT ============

  async getAccount(exchange?: string): Promise<any> {
    const query = exchange ? `?exchange=${exchange}` : '';
    const data = await this.request('GET', `/account${query}`);
    return data.data;
  }

  // ============ ORDERS ============

  async placeOrder(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT';
    quantity?: string;
    price?: string;
    triggerPrice?: string;
    takeProfit?: string;
    stopLoss?: string;
    reduceOnly?: boolean;
    leverage?: number;
    trailingDelta?: string;
    exchange?: string;
  }): Promise<any> {
    const response = await this.request('POST', '/order', params);
    
    // Check if the response indicates failure
    if (response.success === false) {
      throw new Error(response.error || 'Order placement failed');
    }
    
    // Return the actual order data
    return response.data || response;
  }

  async getOpenOrders(symbol?: string, exchange?: string): Promise<any[]> {
    let query = '';
    const params = [];
    if (symbol) params.push(`symbol=${symbol}`);
    if (exchange) params.push(`exchange=${exchange}`);
    if (params.length > 0) query = '?' + params.join('&');

    const data = await this.request('GET', `/orders${query}`);
    return data.data;
  }

  async cancelOrder(orderId: string, symbol?: string, exchange?: string): Promise<any> {
    let query = '';
    const params = [];
    if (symbol) params.push(`symbol=${symbol}`);
    if (exchange) params.push(`exchange=${exchange}`);
    if (params.length > 0) query = '?' + params.join('&');

    const data = await this.request('DELETE', `/order/${orderId}${query}`);
    return data.data;
  }

  async cancelAllOrders(symbol?: string, exchange?: string): Promise<any> {
    let query = '';
    const params = [];
    if (symbol) params.push(`symbol=${symbol}`);
    if (exchange) params.push(`exchange=${exchange}`);
    if (params.length > 0) query = '?' + params.join('&');

    return await this.request('DELETE', `/orders${query}`);
  }

  async getOrderHistory(symbol?: string, limit?: number, exchange?: string): Promise<any[]> {
    let query = '';
    const params = [];
    if (symbol) params.push(`symbol=${symbol}`);
    if (limit) params.push(`limit=${limit}`);
    if (exchange) params.push(`exchange=${exchange}`);
    if (params.length > 0) query = '?' + params.join('&');

    const data = await this.request('GET', `/orders/history${query}`);
    return data.data;
  }

  // ============ POSITIONS ============

  async getPositions(exchange?: string): Promise<any[]> {
    const query = exchange ? `?exchange=${exchange}` : '';
    const data = await this.request('GET', `/positions${query}`);
    return data.data;
  }

  // ============ LEVERAGE & MARGIN ============

  async setLeverage(symbol: string, leverage: number, exchange?: string): Promise<any> {
    return await this.request('POST', '/account/leverage', {
      symbol,
      leverage,
      exchange,
    });
  }

  async setMarginMode(symbol: string, mode: 'ISOLATED' | 'CROSS', exchange?: string): Promise<any> {
    return await this.request('POST', '/account/margin-mode', {
      symbol,
      mode,
      exchange,
    });
  }

  // ============ MARKET DATA ============

  async getTicker(symbol: string, exchange?: string): Promise<any> {
    const query = exchange ? `?exchange=${exchange}` : '';
    const data = await this.request('GET', `/ticker/${symbol}${query}`);
    return data.data;
  }

  async getAssets(exchange?: string): Promise<any[]> {
    const query = exchange ? `?exchange=${exchange}` : '';
    const data = await this.request('GET', `/assets${query}`);
    return data.data;
  }

  async searchAssets(searchQuery: string): Promise<any> {
    const data = await this.request('GET', `/assets/search?q=${encodeURIComponent(searchQuery)}`);
    return data.data;
  }
}
