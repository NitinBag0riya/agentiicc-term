
import { createApiServer } from './api/server';

console.log('🚀 Starting Standalone API Server (No DB)...');
console.log('⚠️  Only public endpoints will work (Orderbook, Ticker, Assets)');

createApiServer(3000);
