const BASE_URL = 'http://localhost:3000';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    token?: string;
    activeExchange?: string;
    linkedExchanges?: string[];
}

export class ApiClient {
    private static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const url = `${BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            const response = await fetch(url, { ...options, headers });
            const data = await response.json();
            return data as ApiResponse<T>;
        } catch (error) {
            throw new Error(`API Request Failed: ${error}`);
        }
    }

    static async createUser(telegramId: number, username?: string): Promise<ApiResponse<{ id: number }>> {
        return this.request('/user', {
            method: 'POST',
            body: JSON.stringify({ telegramId, username }),
        });
    }

    static async linkCredentials(userId: number, exchange: 'aster' | 'hyperliquid', credentials: any): Promise<ApiResponse> {
        const payload: any = { userId, exchange };

        if (exchange === 'aster') {
            payload.apiKey = credentials.apiKey;
            payload.apiSecret = credentials.apiSecret;
        } else {
            payload.address = credentials.address;
            payload.privateKey = credentials.privateKey;
        }

        return this.request('/user/credentials', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    static async createSession(userId: number, exchangeId?: string): Promise<ApiResponse> {
        return this.request('/auth/session', {
            method: 'POST',
            body: JSON.stringify({ userId, exchangeId }),
        });
    }

    static async getAccount(token: string, exchange?: string): Promise<ApiResponse<any>> {
        const query = exchange ? `?exchange=${exchange}` : '';
        return this.request(`/account${query}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    static async getTicker(token: string, symbol: string, exchange?: string): Promise<ApiResponse<any>> {
        const query = exchange ? `?exchange=${exchange}` : '';
        return this.request(`/ticker/${symbol}${query}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    static async placeOrder(token: string, order: any): Promise<ApiResponse<any>> {
        return this.request('/order', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(order)
        });
    }
    static async closePosition(token: string, params: {
        exchange: string;
        symbol: string;
        action?: 'CLOSE_ALL';
    }): Promise<ApiResponse<any>> {
        return this.request('/position/close', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params)
        });
    }

    static async setTpSl(token: string, params: {
        exchange: string;
        symbol: string;
        tp?: string;
        sl?: string;
    }): Promise<ApiResponse<any>> {
        return this.request('/position/tp-sl', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params)
        });
    }

    static async switchExchange(token: string, exchange: string): Promise<ApiResponse<any>> {
        return this.request('/auth/session/switch', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ exchange })
        });
    }

    static async getAssets(token: string, exchange: string): Promise<ApiResponse<any>> {
        return this.request(`/assets?exchange=${exchange}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    static async setLeverage(token: string, params: { exchange: string, symbol: string, leverage: number }): Promise<ApiResponse<any>> {
        return this.request('/account/leverage', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params)
        });
    }

    static async setMarginMode(token: string, params: { exchange: string, symbol: string, mode: 'CROSS' | 'ISOLATED' }): Promise<ApiResponse<any>> {
        return this.request('/account/margin-mode', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params)
        });
    }

    static async updateMargin(token: string, params: { exchange: string, symbol: string, amount: number, type: 'ADD' | 'REMOVE' }): Promise<ApiResponse<any>> {
        return this.request('/position/margin', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params)
        });
    }

    static async searchAssets(token: string, query: string): Promise<ApiResponse<any>> {
        return this.request(`/assets/search?q=${query}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    static async getOpenOrders(token: string, symbol?: string): Promise<ApiResponse<any>> {
        const query = symbol ? `?symbol=${symbol}` : '';
        return this.request(`/orders${query}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    static async cancelOrder(token: string, orderId: string, symbol?: string): Promise<ApiResponse<any>> {
        return this.request(`/order/${orderId}${symbol ? `?symbol=${symbol}` : ''}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    // Get positions from /fapi/v1/positionRisk (accurate leverage/margin data)
    static async getPositions(token: string, exchange?: string, symbol?: string): Promise<ApiResponse<any[]>> {
        let query = '';
        const params: string[] = [];
        if (exchange) params.push(`exchange=${exchange}`);
        if (symbol) params.push(`symbol=${symbol}`);
        if (params.length) query = '?' + params.join('&');

        return this.request(`/positions${query}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
}
