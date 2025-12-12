#!/bin/bash

# Universal API Test Script
# Tests all public endpoints for both Aster and Hyperliquid

API_BASE="http://localhost:3000"
PASSED=0
FAILED=0

echo ""
echo "🧪 Universal API Test Suite"
echo "=============================="
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    
    response=$(curl -s -w "\n%{http_code}" "$API_BASE$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo "✅ $name"
        ((PASSED++))
    else
        echo "❌ $name (HTTP $http_code)"
        ((FAILED++))
    fi
}

echo "📖 PUBLIC ENDPOINTS"
echo ""

test_endpoint "Health Check" "/health"
test_endpoint "Assets (Aster)" "/assets?exchange=aster"
test_endpoint "Assets (Hyperliquid)" "/assets?exchange=hyperliquid"
test_endpoint "Assets Search" "/assets/search?q=ETH"
test_endpoint "Ticker Aster (ETHUSDT)" "/ticker/ETHUSDT?exchange=aster"
test_endpoint "Ticker Hyperliquid (ETH)" "/ticker/ETH?exchange=hyperliquid"
test_endpoint "Orderbook Aster" "/orderbook/ETHUSDT?exchange=aster&depth=5"
test_endpoint "Orderbook Hyperliquid" "/orderbook/ETH?exchange=hyperliquid&depth=5"

echo ""
echo "=============================="
echo "📊 Results: $PASSED passed, $FAILED failed"
echo "=============================="
echo ""

exit $FAILED
