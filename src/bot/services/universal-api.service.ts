/**
 * Universal API Service
 * Centralized service for all exchange operations
 * Wraps AdapterFactory to provide a unified interface for the bot
 */

import { AdapterFactory } from '../../adapters/factory';
import type { ExchangeAdapter, AccountInfo, Position, Ticker, OrderResult, PlaceOrderParams, Asset, Order } from '../../adapters/base.adapter';

export class UniversalApiService {
  
  /**
   * Get authenticated adapter for a user
   */
  private static async getAdapter(userId: number, exchangeId: string): Promise<ExchangeAdapter> {
    try {
      return await AdapterFactory.createAdapter(userId, exchangeId);
    } catch (error) {
      console.error(`[UniversalAPI] Failed to create adapter for user ${userId} on ${exchangeId}:`, error);
      throw new Error(`Failed to connect to ${exchangeId}. Please check your API credentials.`);
    }
  }

  /**
   * Get public adapter (no auth required)
   */
  private static getPublicAdapter(exchangeId: string): ExchangeAdapter {
    return AdapterFactory.createPublicAdapter(exchangeId);
  }

  /**
   * Get account summary (Balance, Equity, Positions)
   */
  static async getAccountSummary(userId: number, exchangeId: string): Promise<AccountInfo> {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.getAccount();
  }

  /**
   * Get active positions
   */
  static async getPositions(userId: number, exchangeId: string): Promise<Position[]> {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.getPositions();
  }

  /**
   * Get market price for a symbol
   */
  static async getMarketPrice(exchangeId: string, symbol: string): Promise<Ticker> {
    // Ticker defines public data, so we can us public adapter if we want, 
    // but usually it's better to reuse the auth one if available to avoid rate limits?
    // For now, let's use public adapter for price checks to avoid needing user ID
    const adapter = this.getPublicAdapter(exchangeId);
    return await adapter.getTicker(symbol);
  }

  /**
   * Place an order
   */
  static async placeOrder(userId: number, exchangeId: string, params: PlaceOrderParams): Promise<OrderResult> {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.placeOrder(params);
  }

  /**
   * Cancel an order
   */
  static async cancelOrder(userId: number, exchangeId: string, orderId: string, symbol: string) {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.cancelOrder(orderId, symbol);
  }

  /**
   * Search for assets
   */
  static async searchAssets(exchangeId: string, query: string): Promise<Asset[]> {
    const adapter = this.getPublicAdapter(exchangeId);
    const assets = await adapter.getAssets();
    
    const lowerQuery = query.toLowerCase();
    return assets.filter(asset => 
      asset.symbol.toLowerCase().includes(lowerQuery) || 
      asset.baseAsset.toLowerCase().includes(lowerQuery)
    ).slice(0, 10); // Limit to top 10 results
  }

  /**
   * Get specific asset info
   */
  static async getAsset(exchangeId: string, symbol: string): Promise<Asset | undefined> {
    const adapter = this.getPublicAdapter(exchangeId);
    const assets = await adapter.getAssets();
    return assets.find(a => a.symbol === symbol);
  }

  /**
   * Close a position fully
   */
  static async closePosition(userId: number, exchangeId: string, symbol: string): Promise<OrderResult> {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.closePosition(symbol);
  }

  /**
   * Get open orders
   */
  static async getOpenOrders(userId: number, exchangeId: string, symbol?: string): Promise<Order[]> {
    const adapter = await this.getAdapter(userId, exchangeId);
    return await adapter.getOpenOrders(symbol);
  }
}
