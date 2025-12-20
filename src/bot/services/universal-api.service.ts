import axios from 'axios';

const BASE_URL = `http://localhost:${process.env.PORT || 3742}`;

export class UniversalApiService {
  private static async getAuthToken(userId: string): Promise<string> {
    const response = await axios.post(`${BASE_URL}/auth/session`, { userId });
    if (response.data.success) {
      return response.data.token;
    }
    throw new Error(response.data.error || 'Failed to create unified session');
  }

  static async getAccount(userId: string, exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.get(`${BASE_URL}/account`, {
      params: { exchange },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  }

  static async getPositions(userId: string, exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.get(`${BASE_URL}/positions`, {
      params: { exchange },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async linkAccount(userId: string, exchange: string, apiKey: string, apiSecret: string) {
    try {
      const response = await axios.post(`${BASE_URL}/user/credentials`, {
        userId,
        exchange,
        apiKey,
        apiSecret
      });
      return response.data;
    } catch (error: any) {
      console.error('[LinkAccount] Error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }

  static async getAssets(exchange: string) {
    const response = await axios.get(`${BASE_URL}/assets`, {
      params: { exchange }
    });
    return response.data;
  }

  static async searchAssets(query: string) {
    const response = await axios.get(`${BASE_URL}/assets/search`, {
      params: { q: query }
    });
    return response.data; // { success, data: [{ exchange, symbol }, ...] }
  }

  static async switchExchange(userId: string, exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.post(`${BASE_URL}/auth/session/switch`, 
      { exchange },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  static async placeOrder(userId: string, orderData: any) {
    const token = await this.getAuthToken(userId);
    const response = await axios.post(`${BASE_URL}/order`, 
      orderData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  static async setLeverage(userId: string, symbol: string, leverage: number, exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.post(`${BASE_URL}/account/leverage`, 
      { symbol, leverage, exchange },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  static async getOpenOrders(userId: string, exchange: string, symbol: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.get(`${BASE_URL}/orders/open`, {
      params: { exchange, symbol },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async cancelOrder(userId: string, exchange: string, orderId: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.delete(`${BASE_URL}/order`, {
      data: { exchange, orderId },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async cancelAllOrders(userId: string, exchange: string, symbol: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.delete(`${BASE_URL}/orders/all`, {
      data: { exchange, symbol },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }

  static async setMarginMode(userId: string, symbol: string, mode: 'CROSS' | 'ISOLATED', exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.post(`${BASE_URL}/account/margin-mode`, 
      { symbol, mode, exchange },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }

  static async updatePositionMargin(userId: string, symbol: string, amount: string, type: 'ADD' | 'REMOVE', exchange: string) {
    const token = await this.getAuthToken(userId);
    const response = await axios.post(`${BASE_URL}/account/margin`, 
      { symbol, amount, type, exchange },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }
}
