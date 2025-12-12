#!/usr/bin/env bun
/**
 * Advanced Trading Features Test Suite
 * Tests: Leverage, Margin Modes, Cross/Isolated, Single/Multi-Asset
 */

import 'dotenv/config';
import { AsterAdapter } from './adapters/aster.adapter';
import { HyperliquidAdapter } from './adapters/hyperliquid.adapter';

const ASTER_API_KEY = process.env.ASTER_API_KEY || '';
const ASTER_API_SECRET = process.env.ASTER_API_SECRET || '';
const HL_PRIVATE_KEY = (process.env.HYPERLIQUID_PRIVATE_KEY || '').trim();
const HL_ADDRESS = (process.env.HYPERLIQUID_ADDRESS || '').trim();

interface TestResult {
    name: string;
    exchange: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    message: string;
}

const results: TestResult[] = [];

function printResult(result: TestResult) {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️ ';
    const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';
    
    console.log(`${icon} ${color}${result.name}${reset} [${result.exchange}]`);
    console.log(`   ${result.message}`);
}

function printSummary() {
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 ADVANCED FEATURES TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log('='.repeat(70) + '\n');
}

(async () => {
    console.log('\n🚀 \x1b[36mAdvanced Trading Features Test Suite\x1b[0m\n');

    // ========================================
    // ASTER TESTS
    // ========================================
    console.log('🟦 ASTER EXCHANGE TESTS\n');

    if (!ASTER_API_KEY || !ASTER_API_SECRET) {
        console.log('⚠️  Skipping Aster tests (no API credentials)\n');
        results.push({
            name: 'Aster Tests',
            exchange: 'aster',
            status: 'SKIP',
            message: 'No API credentials provided'
        });
    } else {
        const aster = new AsterAdapter(ASTER_API_KEY, ASTER_API_SECRET);
        const symbol = 'ETHUSDT';

        // Test 1: Get Current Margin Mode
        try {
            const mode = await aster.getMarginMode!(symbol);
            results.push({
                name: 'Get Margin Mode',
                exchange: 'aster',
                status: 'PASS',
                message: `Current mode: ${mode}`
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Get Margin Mode',
                exchange: 'aster',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 2: Set Leverage
        try {
            const result = await aster.setLeverage!(symbol, 10);
            results.push({
                name: 'Set Leverage (10x)',
                exchange: 'aster',
                status: result.success ? 'PASS' : 'FAIL',
                message: result.message || 'Leverage set successfully'
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Set Leverage (10x)',
                exchange: 'aster',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 3: Set Cross Margin Mode
        try {
            const result = await aster.setMarginMode!(symbol, 'CROSS');
            results.push({
                name: 'Set Cross Margin',
                exchange: 'aster',
                status: result.success ? 'PASS' : 'FAIL',
                message: result.message || 'Cross margin set'
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Set Cross Margin',
                exchange: 'aster',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 4: Set Isolated Margin Mode
        try {
            const result = await aster.setMarginMode!(symbol, 'ISOLATED');
            results.push({
                name: 'Set Isolated Margin',
                exchange: 'aster',
                status: result.success ? 'PASS' : 'FAIL',
                message: result.message || 'Isolated margin set'
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Set Isolated Margin',
                exchange: 'aster',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 5: Place Order with Leverage
        try {
            const order = await aster.placeOrder({
                symbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: '0.01',
                price: '2000',
                leverage: 5
            });
            results.push({
                name: 'Place Order with Leverage (5x)',
                exchange: 'aster',
                status: 'PASS',
                message: `Order ${order.orderId} placed with 5x leverage`
            });
            printResult(results[results.length - 1]);

            // Cancel the order
            await aster.cancelOrder(order.orderId, symbol);
        } catch (error: any) {
            results.push({
                name: 'Place Order with Leverage (5x)',
                exchange: 'aster',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }
    }

    // ========================================
    // HYPERLIQUID TESTS
    // ========================================
    console.log('\n🟪 HYPERLIQUID EXCHANGE TESTS\n');

    if (!HL_PRIVATE_KEY || !HL_ADDRESS) {
        console.log('⚠️  Skipping Hyperliquid tests (no credentials)\n');
        results.push({
            name: 'Hyperliquid Tests',
            exchange: 'hyperliquid',
            status: 'SKIP',
            message: 'No credentials provided'
        });
    } else {
        let privateKey = HL_PRIVATE_KEY;
        if (!privateKey.startsWith('0x')) {
            privateKey = `0x${privateKey}`;
        }

        const hl = new HyperliquidAdapter(HL_ADDRESS, privateKey);
        const symbol = 'ETH';

        // Test 1: Get Current Margin Mode
        try {
            const mode = await hl.getMarginMode!(symbol);
            results.push({
                name: 'Get Margin Mode',
                exchange: 'hyperliquid',
                status: 'PASS',
                message: `Current mode: ${mode}`
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Get Margin Mode',
                exchange: 'hyperliquid',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 2: Set Leverage
        try {
            const result = await hl.setLeverage!(symbol, 3);
            results.push({
                name: 'Set Leverage (3x)',
                exchange: 'hyperliquid',
                status: result.success ? 'PASS' : 'FAIL',
                message: result.message || 'Leverage set successfully'
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Set Leverage (3x)',
                exchange: 'hyperliquid',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 3: Set Cross Margin Mode
        try {
            const result = await hl.setMarginMode!(symbol, 'CROSS');
            results.push({
                name: 'Set Cross Margin',
                exchange: 'hyperliquid',
                status: result.success ? 'PASS' : 'FAIL',
                message: result.message || 'Cross margin confirmed'
            });
            printResult(results[results.length - 1]);
        } catch (error: any) {
            results.push({
                name: 'Set Cross Margin',
                exchange: 'hyperliquid',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }

        // Test 4: Place Order with Leverage
        try {
            const order = await hl.placeOrder({
                symbol,
                side: 'BUY',
                type: 'LIMIT',
                quantity: '0.005',
                price: '2500',
                leverage: 2
            });
            results.push({
                name: 'Place Order with Leverage (2x)',
                exchange: 'hyperliquid',
                status: 'PASS',
                message: `Order ${order.orderId} placed with leverage`
            });
            printResult(results[results.length - 1]);

            // Cancel the order
            await hl.cancelOrder(order.orderId, symbol);
        } catch (error: any) {
            results.push({
                name: 'Place Order with Leverage (2x)',
                exchange: 'hyperliquid',
                status: 'FAIL',
                message: error.message
            });
            printResult(results[results.length - 1]);
        }
    }

    // Print Summary
    printSummary();

    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
})();
