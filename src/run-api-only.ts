
import { createApiServer } from './api/server';
import { connectPostgres, initSchema } from './db/postgres';

async function start() {
    console.log('🔌 Connecting to PostgreSQL...');
    await connectPostgres();
    await initSchema();
    console.log('✅ Database ready');

    console.log('🚀 Starting Standalone API Server...');
    createApiServer(3000);
}

start();
