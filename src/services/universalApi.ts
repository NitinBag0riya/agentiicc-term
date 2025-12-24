
import axios, { AxiosInstance } from 'axios';


interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  token?: string;
}

export class UniversalApiClient {
  private static instance: UniversalApiClient;
  private client: AxiosInstance;
  private baseUrl: string;
  private sessionToken: string | null = null;
  private userId: number | null = null;

  public constructor() {
    // Backend API is now integrated directly into the main server on port 3000
    this.baseUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    this.client = axios.create({
      baseURL: this.baseUrl,
      validateStatus: () => true, // Handle all status codes
    });
  }

  public static getInstance(): UniversalApiClient {
    if (!UniversalApiClient.instance) {
      UniversalApiClient.instance = new UniversalApiClient();
    }
    return UniversalApiClient.instance;
  }

  /**
   * Initialize session for a user
   */
  public async initSession(userId: number, exchangeId?: string): Promise<boolean> {
    try {
        this.userId = userId;
        const res = await this.client.post<ApiResponse>('/auth/session', { 
            userId, 
            exchangeId 
        });

        if (res.data.success && res.data.token) {
            this.sessionToken = res.data.token;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
            return true;
        }
        return false;
    } catch (e) {
        console.error('[UniversalApi] Init Session Error:', e);
        return false;
    }
  }

  /**
   * Link New Credentials
   */
  public async linkCredentials(userId: number, exchange: 'aster' | 'hyperliquid', credentials: any): Promise<ApiResponse> {
    return (await this.client.post('/user/credentials', {
        userId,
        exchange,
        ...credentials
    })).data;
  }

  /**
   * Get Account Info
   */
  public async getAccount(exchange?: string): Promise<ApiResponse> {
    return (await this.client.get('/account', { params: { exchange } })).data;
  }

  /**
   * Get Market Data (Ticker)
   */
  public async getTicker(symbol: string, exchange?: string): Promise<ApiResponse> {
    return (await this.client.get(`/ticker/${symbol}`, { params: { exchange } })).data;
  }
  
  /**
   * Get Assets
   */
  public async getAssets(exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/assets', { params: { exchange } })).data;
  }

  /**
   * Search Assets
   */
  public async searchAssets(query: string): Promise<ApiResponse> {
      return (await this.client.get('/assets/search', { params: { q: query } })).data;
  }

  /**
   * Place Order
   */
  public async placeOrder(orderData: any): Promise<ApiResponse> {
    return (await this.client.post('/order', orderData)).data;
  }

  /**
   * Cancel Order
   */
  public async cancelOrder(orderId: string, symbol: string): Promise<ApiResponse> {
      return (await this.client.delete(`/order/${orderId}`, { params: { symbol } })).data;
  }

  /**
   * Get Open Orders
   */
  public async getOpenOrders(symbol?: string, exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/orders', { params: { symbol, exchange } })).data;
  }
  
  /**
   * Close Position
   */
  public async closePosition(symbol: string): Promise<ApiResponse> {
      return (await this.client.post('/position/close', { symbol })).data;
  }
  /**
   * Cancel All Orders
   */
  public async cancelAllOrders(symbol: string, exchange?: string): Promise<ApiResponse> {
      return (await this.client.delete('/orders', { params: { symbol, exchange } })).data;
  }

  /**
   * Set Leverage
   */
  public async setLeverage(symbol: string, leverage: number, exchange?: string): Promise<ApiResponse> {
      return (await this.client.post('/account/leverage', { symbol, leverage, exchange })).data;
  }

  /**
   * Set Margin Mode
   */
  public async setMarginMode(symbol: string, mode: string, exchange?: string): Promise<ApiResponse> {
      return (await this.client.post('/account/margin-mode', { symbol, mode, exchange })).data;
  }

  /**
   * Get Multi-Assets Margin
   */
  public async getMultiAssetsMargin(exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/account/multiAssetsMargin', { params: { exchange } })).data;
  }

  /**
   * Set Multi-Assets Margin
   */
  public async setMultiAssetsMargin(multiAssetsMargin: boolean, exchange?: string): Promise<ApiResponse> {
      return (await this.client.post('/account/multiAssetsMargin', { multiAssetsMargin, exchange })).data;
  }

  /**
   * Modify Position Margin
   */
  public async modifyPositionMargin(symbol: string, amount: string, type: any, exchange?: string): Promise<ApiResponse> {
      return (await this.client.post('/position/margin', { symbol, amount, type, exchange })).data;
  }

  /**
   * Get Positions
   */
  public async getPositions(exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/positions', { params: { exchange } })).data;
  }

  /**
   * Get Orderbook
   */
  public async getOrderbook(symbol: string, exchange?: string, depth?: number): Promise<ApiResponse> {
      return (await this.client.get(`/orderbook/${symbol}`, { params: { exchange, depth } })).data;
  }

  /**
   * Get Order History
   */
  public async getOrderHistory(symbol?: string, limit?: number, exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/orders/history', { params: { symbol, limit, exchange } })).data;
  }

  /**
   * Get Fills (Trade History)
   */
  public async getFills(symbol?: string, limit?: number, exchange?: string): Promise<ApiResponse> {
      return (await this.client.get('/fills', { params: { symbol, limit, exchange } })).data;
  }

  /**
   * Get OHLCV (Candlestick Data)
   */
  public async getOHLCV(symbol: string, timeframe?: string, limit?: number, exchange?: string): Promise<ApiResponse> {
      return (await this.client.get(`/ohlcv/${symbol}`, { params: { exchange, tf: timeframe, limit } })).data;
  }
}

export const universalApi = UniversalApiClient.getInstance();
