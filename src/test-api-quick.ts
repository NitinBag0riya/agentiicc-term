#!/usr/bin/env bun
import 'dotenv/config';

const API_BASE = 'http://localhost:3000';

const tests = [
    // Public Endpoints
    { name: 'Health Check', url: '/health', method: 'GET' },
    { name: 'Assets (Aster)', url: '/assets?exchange=aster', method: 'GET' },
    { name: 'Assets (Hyperliquid)', url: '/assets?exchange=hyperliquid', method: 'GET' },
    { name: 'Ticker Aster (ETHUSDT)', url: '/ticker/ETHUSDT?exchange=aster', method: 'GET' },
    { name: 'Ticker Hyperliquid (ETH)', url: '/ticker/ETH?exchange=hyperliquid', method: 'GET' },
    { name: 'Orderbook Aster', url: '/orderbook/ETHUSDT?exchange=aster&depth=5', method: 'GET' },
    { name: 'Orderbook Hyperliquid', url: '/orderbook/ETH?exchange=hyperliquid&depth=5', method: 'GET' },
    { name: 'Assets Search', url: '/assets/search?q=ETH', method: 'GET' },
];

let passed = 0;
let failed = 0;

console.log('\n🧪 Quick API Test Suite\n');

for (const test of tests) {
    try {
        const response = await fetch(`${API_BASE}${test.url}`, {
            method: test.method,
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        const data = await response.json();
        
        if (response.ok && data.success !== false) {
            console.log(`✅ ${test.name}`);
            passed++;
        } else {
            console.log(`❌ ${test.name}`);
            console.log(`   Error: ${data.error || 'Unknown error'}`);
            failed++;
        }
    } catch (error: any) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        failed++;
    }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests\n`);

process.exit(failed > 0 ? 1 : 0);
