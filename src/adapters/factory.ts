/**
 * Adapter Factory
 * Creates the appropriate exchange adapter based on credentials
 */

import type { ExchangeAdapter } from './base.adapter';
import { AsterAdapter } from './aster.adapter';
import { HyperliquidAdapter } from './hyperliquid.adapter';
import { getApiCredentials } from '../db/users';
import { decrypt } from '../utils/encryption';

export class AdapterFactory {
  static async createAdapter(userId: number, exchangeId: string): Promise<ExchangeAdapter> {
    // Get encrypted credentials from database
    const credentials = await getApiCredentials(userId, exchangeId);

    if (!credentials) {
      throw new Error(`No credentials found for exchange: ${exchangeId}`);
    }

    // Decrypt credentials
    const apiKey = decrypt(credentials.api_key_encrypted); // Private Key
    const apiSecret = decrypt(credentials.api_secret_encrypted); // Wallet Address

    // Create appropriate adapter
    if (exchangeId === 'aster') {
      return new AsterAdapter(apiKey, apiSecret);
    } else if (exchangeId === 'hyperliquid') {
      // server.ts stored:
      // api_key_encrypted = Private Key
      // api_secret_encrypted = Address
      // So apiKey = PrivateKey, apiSecret = Address

      // HyperliquidAdapter constructor: (accountAddress, privateKey)
      return new HyperliquidAdapter(apiSecret, apiKey);
    } else {
      throw new Error(`Unsupported exchange: ${exchangeId}`);
    }
  }

  static createPublicAdapter(exchangeId: string): ExchangeAdapter {
    if (exchangeId === 'aster') {
      return new AsterAdapter('', '');
    } else if (exchangeId === 'hyperliquid') {
      return new HyperliquidAdapter('');
    } else {
      throw new Error(`Unsupported exchange: ${exchangeId}`);
    }
  }
}
