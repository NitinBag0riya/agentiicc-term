/**
 * Production-Ready API Server Entry Point
 * Uses Bun + Elysia
 */

import { connectPostgres } from './db/postgres';
import { createApiServer } from './api/server';

const PORT = 3000;

async function start() {
    try {
        // 1. Connect to Database (Required for Auth)
        console.log('🔌 Connecting to Database...');
        await connectPostgres();

        // 2. Start API Server
        console.log('🚀 Starting Universal API Server...');
        createApiServer(PORT);
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

start();
