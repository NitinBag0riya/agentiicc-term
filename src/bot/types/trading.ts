/**
 * Generic Trading Operation Types
 * Used for confirmation dialogs and execution via Universal API
 */

export type OperationType = 
  | 'CREATE_ORDER'
  | 'CANCEL_ORDER'
  | 'CANCEL_ALL_ORDERS'
  | 'CLOSE_POSITION'
  | 'SET_LEVERAGE'
  | 'SET_MARGIN_MODE'
  | 'SET_MULTI_ASSETS_MARGIN';

export interface TradingOperation {
  operation: OperationType;
  params: any;
  metadata?: {
    exchange?: string;
    description?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    [key: string]: any;
  };
}

export interface OperationResult {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
}
