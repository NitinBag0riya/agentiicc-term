# Unified Trading API Documentation

## Overview

A normalized REST API that provides unified access to multiple exchanges (Aster DEX, Hyperliquid) through a single interface.

## Base URL

```
http://localhost:3000
```

## Authentication

All protected endpoints require a session token in the Authorization header:

```
Authorization: Bearer <session-token>
```

---

## Endpoints

### 🔐 Authentication

#### Create Session

```http
POST /auth/session
Content-Type: application/json

{
  "userId": 1,
  "exchangeId": "aster"  // or "hyperliquid"
}
```

**Response:**

```json
{
  "success": true,
  "token": "1234567890-abc123def456",
  "expiresIn": "24h"
}
```

#### Delete Session (Logout)

```http
DELETE /auth/session
Authorization: Bearer <token>
```

---

### 💰 Account

#### Get Account Info

```http
GET /account
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "exchange": "aster",
    "totalBalance": "1234.56",
    "availableBalance": "987.65",
    "positions": [
      {
        "symbol": "BTCUSDT",
        "size": "0.5",
        "entryPrice": "45000",
        "markPrice": "46000",
        "unrealizedPnl": "500.00",
        "side": "LONG",
        "leverage": "10",
        "liquidationPrice": "40000"
      }
    ],
    "timestamp": 1702345678901
  }
}
```

---

### 📊 Orders

#### Place Order

```http
POST /order
Authorization: Bearer <token>
Content-Type: application/json

{
  "symbol": "BTCUSDT",
  "side": "BUY",           // BUY or SELL
  "type": "LIMIT",         // MARKET or LIMIT
  "quantity": "0.1",
  "price": "45000",        // Required for LIMIT orders
  "takeProfit": "50000",   // Optional
  "stopLoss": "40000",     // Optional
  "reduceOnly": false,     // Optional
  "leverage": 10           // Optional
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "12345",
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": "0.1",
    "price": "45000",
    "status": "NEW",
    "timestamp": 1702345678901
  }
}
```

#### Get Open Orders

```http
GET /orders?symbol=BTCUSDT
Authorization: Bearer <token>
```

**Query Parameters:**

- `symbol` (optional): Filter by symbol

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "orderId": "12345",
      "symbol": "BTCUSDT",
      "side": "BUY",
      "type": "LIMIT",
      "quantity": "0.1",
      "price": "45000",
      "filled": "0",
      "status": "NEW",
      "timestamp": 1702345678901
    }
  ]
}
```

#### Get Order History

```http
GET /orders/history?symbol=BTCUSDT&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**

- `symbol` (optional): Filter by symbol
- `limit` (optional): Number of orders (default: 50)

#### Cancel Order

```http
DELETE /order/:orderId?symbol=BTCUSDT
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "12345",
    "symbol": "BTCUSDT",
    "status": "CANCELED",
    "message": "Order canceled successfully"
  }
}
```

---

### 📈 Positions

#### Get Positions

```http
GET /positions?symbol=BTCUSDT
Authorization: Bearer <token>
```

**Query Parameters:**

- `symbol` (optional): Filter by symbol

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTCUSDT",
      "size": "0.5",
      "entryPrice": "45000",
      "markPrice": "46000",
      "unrealizedPnl": "500.00",
      "side": "LONG",
      "leverage": "10",
      "liquidationPrice": "40000"
    }
  ]
}
```

---

### 📖 Market Data (Public)

#### Get Orderbook

```http
GET /orderbook/BTCUSDT?depth=20&exchange=aster
```

**Query Parameters:**

- `depth` (optional): Orderbook depth (default: 20)
- `exchange` (optional): `aster` (default) or `hyperliquid`

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": {
    "symbol": "BTCUSDT",
    "bids": [
      ["45000", "1.5"],
      ["44999", "2.0"]
    ],
    "asks": [
      ["45001", "1.2"],
      ["45002", "1.8"]
    ],
    "timestamp": 1702345678901
  }
}
```

#### Get Ticker

```http
GET /ticker/BTCUSDT?exchange=aster
```

**Query Parameters:**

- `exchange` (optional): `aster` (default) or `hyperliquid`

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": {
    "symbol": "BTCUSDT",
    "price": "45000",
    "change24h": "2.5",
    "volume24h": "1234567",
    "high24h": "46000",
    "low24h": "44000",
    "timestamp": 1702345678901
  }
}
```

#### Get Assets

```http
GET /assets?exchange=aster
```

**Query Parameters:**

- `exchange` (optional): `aster` or `hyperliquid` (default: aster)

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": [
    {
      "symbol": "BTCUSDT",
      "name": "BTCUSDT",
      "baseAsset": "BTC",
      "quoteAsset": "USDT",
      "minQuantity": "0.001",
      "maxQuantity": "1000",
      "tickSize": "0.01"
    }
  ]
}
```

#### Search Assets

```http
GET /assets/search?q=BTC
```

**Query Parameters:**

- `q`: Search term

**Response:**

```json
{
  "success": true,
  "query": "btc",
  "count": 5,
  "data": [
    {
      "symbol": "BTCUSDT",
      "name": "BTCUSDT",
      "baseAsset": "BTC",
      "quoteAsset": "USDT",
      "exchange": "aster"
    },
    {
      "symbol": "BTC",
      "name": "BTC",
      "baseAsset": "BTC",
      "quoteAsset": "USD",
      "exchange": "hyperliquid"
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

---

## Example Usage

### JavaScript/TypeScript

```typescript
const API_URL = 'http://localhost:3000';

// 1. Create session
const sessionRes = await fetch(`${API_URL}/auth/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 1,
    exchangeId: 'aster',
  }),
});
const { token } = await sessionRes.json();

// 2. Get account
const accountRes = await fetch(`${API_URL}/account`, {
  headers: { Authorization: `Bearer ${token}` },
});
const account = await accountRes.json();

// 3. Place order
const orderRes = await fetch(`${API_URL}/order`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: '0.1',
    price: '45000',
  }),
});
const order = await orderRes.json();

// 4. Search assets
const searchRes = await fetch(`${API_URL}/assets/search?q=BTC`);
const assets = await searchRes.json();
```

### cURL

```bash
# Create session
curl -X POST http://localhost:3000/auth/session \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "exchangeId": "aster"}'

# Get account
curl http://localhost:3000/account \
  -H "Authorization: Bearer <token>"

# Place order
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "LIMIT",
    "quantity": "0.1",
    "price": "45000"
  }'

# Search assets
curl http://localhost:3000/assets/search?q=BTC
```

---

## Rate Limits

- Public endpoints: No limit
- Authenticated endpoints: Depends on exchange limits

## Notes

- All prices and quantities are strings to preserve precision
- Timestamps are in milliseconds (Unix epoch)
- Order IDs are strings
- Session tokens expire after 24 hours
