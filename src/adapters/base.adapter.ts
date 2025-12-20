/**
 * Extended Base Exchange Adapter Interface
 * Defines all trading operations
 */

export interface ExchangeAdapter {
  // Account operations
  getAccount(): Promise<AccountInfo>;
  
  // Order operations
  placeOrder(params: PlaceOrderParams): Promise<OrderResult>;
  cancelOrder(orderId: string, symbol?: string): Promise<CancelResult>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getOrderHistory(symbol?: string, limit?: number): Promise<Order[]>;
  getFills(symbol?: string, limit?: number): Promise<Fill[]>;
  
  // Position operations
  getPositions(symbol?: string): Promise<Position[]>;
  closePosition(symbol: string): Promise<OrderResult>;
  setPositionTPSL(symbol: string, tpPrice?: string, slPrice?: string): Promise<{ success: boolean; message: string }>;
  updatePositionMargin(symbol: string, amount: string, type: 'ADD' | 'REMOVE'): Promise<{ success: boolean; message: string }>;
  
  // Margin & Leverage operations
  setLeverage(symbol: string, leverage: number): Promise<{ success: boolean; message?: string }>;
  setMarginMode(symbol: string, mode: 'CROSS' | 'ISOLATED'): Promise<{ success: boolean; message?: string }>;
  getMarginMode(symbol: string): Promise<'CROSS' | 'ISOLATED'>;

  // Order operations extension
  cancelAllOrders(symbol?: string): Promise<{ success: boolean; canceledCount: number; message: string }>;
  
  // Market data
  getOrderbook(symbol: string, depth?: number): Promise<Orderbook>;
  getTicker(symbol: string): Promise<Ticker>;
  getAssets(): Promise<Asset[]>;
  getOHLCV(symbol: string, timeframe: string, limit?: number): Promise<OHLCV[]>;
}

// Account types
export interface AccountInfo {
  exchange: string;
  totalBalance: string;
  availableBalance: string;
  positions?: Position[];
  timestamp: number;
}

export interface Position {
  symbol: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  side: 'LONG' | 'SHORT';
  leverage?: string;
  liquidationPrice?: string;
}

// Order types
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT' | 'TAKE_PROFIT_MARKET' | 'TAKE_PROFIT_LIMIT' | 'TRAILING_STOP_MARKET' | 'OCO';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export interface PlaceOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: OrderType;
  quantity: string;
  price?: string;
  triggerPrice?: string; // For STOP/TP/TRAILING
  stopLimitPrice?: string; // For OCO (Limit price of the stop leg) or separate Stop-Limit execution price
  trailingDelta?: string; // For TRAILING_STOP (callback rate/amount)
  timeInForce?: TimeInForce;
  postOnly?: boolean;
  takeProfit?: string; // Attached TP (Strategy)
  stopLoss?: string;   // Attached SL (Strategy)
  reduceOnly?: boolean;
  leverage?: number;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: OrderType;
  quantity: string;
  price?: string;
  status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'REJECTED'; 

  timestamp: number;
}

export interface CancelResult {
  orderId: string;
  symbol: string;
  status: 'CANCELED' | 'FAILED';
  message?: string;
}

export interface Order {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: OrderType;
  quantity: string;
  price?: string;
  filled: string;
  status: string;
  timestamp: number;
}

// Market data types
export interface Orderbook {
  symbol: string;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
  timestamp: number;
}

export interface Ticker {
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
  high24h: string;
  low24h: string;
  timestamp: number;
}

export interface Asset {
  symbol: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  minQuantity?: string;
  maxQuantity?: string;
  stepSize?: string;
  tickSize?: string;
}

export interface Fill {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string;
  quantity: string;
  fee: string;
  feeCurrency: string;
  timestamp: number;
}

export interface OHLCV {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}


