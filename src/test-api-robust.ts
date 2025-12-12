#!/usr/bin/env bun
/**
 * Robust Universal API Test Suite
 * Tests all endpoints with both Aster and Hyperliquid
 * Validates HTTP status, response structure, and data integrity
 */

const API_BASE = 'http://localhost:3000';

interface TestResult {
    name: string;
    exchange: string;
    endpoint: string;
    status: 'PASS' | 'FAIL';
    httpCode?: number;
    issues: string[];
    responseTime?: number;
}

const results: TestResult[] = [];

// Validation helpers
function validateResponse(data: any, expectedFields: string[]): string[] {
    const issues: string[] = [];
    
    if (!data) {
        issues.push('Response is null or undefined');
        return issues;
    }
    
    // Check if response has success field and it's not false
    if (data.success === false) {
        issues.push(`API returned success: false - ${data.error || data.message || 'Unknown error'}`);
    }
    
    // Check for expected fields
    for (const field of expectedFields) {
        if (!(field in data)) {
            issues.push(`Missing field: ${field}`);
        }
    }
    
    return issues;
}

function validateArray(data: any, minLength: number = 0): string[] {
    const issues: string[] = [];
    
    if (!Array.isArray(data)) {
        issues.push('Expected array but got: ' + typeof data);
        return issues;
    }
    
    if (data.length < minLength) {
        issues.push(`Array too short: expected at least ${minLength}, got ${data.length}`);
    }
    
    return issues;
}

async function testEndpoint(
    name: string,
    endpoint: string,
    exchange: string,
    validator: (data: any) => string[]
): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
        name,
        exchange,
        endpoint,
        status: 'PASS',
        issues: []
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        result.httpCode = response.status;
        result.responseTime = Date.now() - startTime;
        
        // Check HTTP status
        if (!response.ok) {
            result.issues.push(`HTTP ${response.status}: ${response.statusText}`);
            result.status = 'FAIL';
        }
        
        // Parse JSON
        let data;
        try {
            data = await response.json();
        } catch (e) {
            result.issues.push('Invalid JSON response');
            result.status = 'FAIL';
            return result;
        }
        
        // Validate response structure
        const validationIssues = validator(data);
        if (validationIssues.length > 0) {
            result.issues.push(...validationIssues);
            result.status = 'FAIL';
        }
        
    } catch (error: any) {
        result.issues.push(`Request failed: ${error.message}`);
        result.status = 'FAIL';
    }
    
    return result;
}

function printResult(result: TestResult) {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const color = result.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${icon} ${color}${result.name}${reset} [${result.exchange}] ${result.responseTime ? `(${result.responseTime}ms)` : ''}`);
    
    if (result.issues.length > 0) {
        result.issues.forEach(issue => {
            console.log(`   └─ ${issue}`);
        });
    }
}

function printSummary() {
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    
    // Group by exchange
    const asterResults = results.filter(r => r.exchange === 'aster');
    const hlResults = results.filter(r => r.exchange === 'hyperliquid');
    const systemResults = results.filter(r => r.exchange === 'system');
    
    if (asterResults.length > 0) {
        const asterPassed = asterResults.filter(r => r.status === 'PASS').length;
        console.log(`\n🟦 Aster: ${asterPassed}/${asterResults.length} passed`);
    }
    
    if (hlResults.length > 0) {
        const hlPassed = hlResults.filter(r => r.status === 'PASS').length;
        console.log(`🟪 Hyperliquid: ${hlPassed}/${hlResults.length} passed`);
    }
    
    console.log('='.repeat(70));
    
    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:\n');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   ${r.name} [${r.exchange}]`);
            r.issues.forEach(issue => console.log(`      • ${issue}`));
            console.log();
        });
    }
}

// Main test execution
(async () => {
    console.log('\n🚀 \x1b[36mRobust Universal API Test Suite\x1b[0m\n');
    console.log('Testing all endpoints with structure validation...\n');
    
    // ========================================
    // SYSTEM ENDPOINTS
    // ========================================
    console.log('🔧 SYSTEM ENDPOINTS\n');
    
    let result = await testEndpoint(
        'Health Check',
        '/health',
        'system',
        (data) => validateResponse(data, ['status'])
    );
    printResult(result);
    results.push(result);
    
    // ========================================
    // PUBLIC MARKET DATA - ASTER
    // ========================================
    console.log('\n🟦 ASTER PUBLIC ENDPOINTS\n');
    
    result = await testEndpoint(
        'Assets List',
        '/assets?exchange=aster',
        'aster',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                issues.push(...validateArray(data.data, 1));
                if (Array.isArray(data.data) && data.data[0]) {
                    const asset = data.data[0];
                    if (!asset.symbol) issues.push('Asset missing symbol field');
                    if (!asset.baseAsset) issues.push('Asset missing baseAsset field');
                }
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    result = await testEndpoint(
        'Ticker',
        '/ticker/ETHUSDT?exchange=aster',
        'aster',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                if (!data.data.symbol) issues.push('Ticker missing symbol');
                if (!data.data.price) issues.push('Ticker missing price');
                if (parseFloat(data.data.price) <= 0) issues.push('Invalid price value');
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    result = await testEndpoint(
        'Orderbook',
        '/orderbook/ETHUSDT?exchange=aster&depth=5',
        'aster',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                if (!data.data.bids) issues.push('Orderbook missing bids');
                if (!data.data.asks) issues.push('Orderbook missing asks');
                if (data.data.bids && !Array.isArray(data.data.bids)) {
                    issues.push('Bids is not an array');
                }
                if (data.data.asks && !Array.isArray(data.data.asks)) {
                    issues.push('Asks is not an array');
                }
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    // ========================================
    // PUBLIC MARKET DATA - HYPERLIQUID
    // ========================================
    console.log('\n🟪 HYPERLIQUID PUBLIC ENDPOINTS\n');
    
    result = await testEndpoint(
        'Assets List',
        '/assets?exchange=hyperliquid',
        'hyperliquid',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                issues.push(...validateArray(data.data, 1));
                if (Array.isArray(data.data) && data.data[0]) {
                    const asset = data.data[0];
                    if (!asset.symbol) issues.push('Asset missing symbol field');
                }
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    result = await testEndpoint(
        'Ticker',
        '/ticker/ETH?exchange=hyperliquid',
        'hyperliquid',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                if (!data.data.symbol) issues.push('Ticker missing symbol');
                if (!data.data.price) issues.push('Ticker missing price');
                if (parseFloat(data.data.price) <= 0) issues.push('Invalid price value');
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    result = await testEndpoint(
        'Orderbook',
        '/orderbook/ETH?exchange=hyperliquid&depth=5',
        'hyperliquid',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                if (!data.data.bids) issues.push('Orderbook missing bids');
                if (!data.data.asks) issues.push('Orderbook missing asks');
                if (data.data.bids && !Array.isArray(data.data.bids)) {
                    issues.push('Bids is not an array');
                }
                if (data.data.asks && !Array.isArray(data.data.asks)) {
                    issues.push('Asks is not an array');
                }
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    // ========================================
    // CROSS-EXCHANGE ENDPOINTS
    // ========================================
    console.log('\n🔀 CROSS-EXCHANGE ENDPOINTS\n');
    
    result = await testEndpoint(
        'Assets Search',
        '/assets/search?q=ETH',
        'both',
        (data) => {
            const issues = validateResponse(data, ['success', 'data']);
            if (data.data) {
                if (!data.data.aster) issues.push('Missing aster results');
                if (!data.data.hyperliquid) issues.push('Missing hyperliquid results');
                if (data.data.aster && !Array.isArray(data.data.aster)) {
                    issues.push('Aster results not an array');
                }
                if (data.data.hyperliquid && !Array.isArray(data.data.hyperliquid)) {
                    issues.push('Hyperliquid results not an array');
                }
            }
            return issues;
        }
    );
    printResult(result);
    results.push(result);
    
    // Print summary
    printSummary();
    
    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
})();
