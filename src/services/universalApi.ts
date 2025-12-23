
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
    // The backend runs on port 3000 by default (proxied via main process port usually)
    // But since backend is spawned on 3001, and main is 3000...
    // Wait, main process calls UniversalApi. Main is on 3000? No main spawns backend on 3001.
    // Bot runs in Main. So Bot should talk to localhost:3001 directly?
    // OR talk to localhost:3000/api via proxy?
    // Using 3001 is faster/direct.
    this.baseUrl = process.env.BACKEND_API_URL || 'http://localhost:3001';
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
  public async getOpenOrders(symbol?: string): Promise<ApiResponse> {
      return (await this.client.get('/orders', { params: { symbol } })).data;
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
}

export const universalApi = UniversalApiClient.getInstance();
