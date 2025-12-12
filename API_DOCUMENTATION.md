# 📚 Universal Trading API - Documentation

## 🚀 Interactive API Documentation

The Universal Trading API now includes **interactive Swagger/OpenAPI documentation**!

### Access the Documentation

**Interactive UI**: [http://localhost:3000/docs/api](http://localhost:3000/docs/api)  
**OpenAPI Spec**: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)

### Start the Server

```bash
# Start API server with documentation
bun run server:docs

# Server will be available at:
# - API: http://localhost:3000
# - Docs: http://localhost:3000/docs/api
```

---

## 📖 API Endpoints

### System Endpoints

#### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1765543493819
}
```

---

### Asset Endpoints

#### Get All Assets

```http
GET /assets?exchange={aster|hyperliquid}
```

**Parameters:**

- `exchange` (required): `aster` or `hyperliquid`

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": [
    {
      "symbol": "ETHUSDT",
      "name": "Ethereum",
      "baseAsset": "ETH",
      "quoteAsset": "USDT",
      "minQuantity": "0.001",
      "tickSize": "0.01"
    }
  ]
}
```

#### Search Assets

```http
GET /assets/search?q={query}
```

**Parameters:**

- `q` (required): Search query (e.g., "ETH", "BTC")

**Response:**

```json
{
  "success": true,
  "data": {
    "aster": [
      { "symbol": "ETHUSDT", "name": "Ethereum", ... }
    ],
    "hyperliquid": [
      { "symbol": "ETH", "name": "Ethereum", ... }
    ]
  }
}
```

---

### Market Data Endpoints

#### Get Ticker

```http
GET /ticker/{symbol}?exchange={aster|hyperliquid}
```

**Parameters:**

- `symbol` (path, required): Trading symbol (e.g., "ETHUSDT" for Aster, "ETH" for Hyperliquid)
- `exchange` (query, required): `aster` or `hyperliquid`

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": {
    "symbol": "ETHUSDT",
    "price": "3240.50",
    "change24h": "2.5",
    "volume24h": "1234567.89",
    "high24h": "3250.00",
    "low24h": "3200.00",
    "timestamp": 1765543493819
  }
}
```

#### Get Orderbook

```http
GET /orderbook/{symbol}?exchange={aster|hyperliquid}&depth={number}
```

**Parameters:**

- `symbol` (path, required): Trading symbol
- `exchange` (query, required): `aster` or `hyperliquid`
- `depth` (query, optional): Number of price levels (default: 20)

**Response:**

```json
{
  "success": true,
  "exchange": "aster",
  "data": {
    "symbol": "ETHUSDT",
    "bids": [
      ["3240.50", "1.5"],
      ["3240.00", "2.3"]
    ],
    "asks": [
      ["3241.00", "1.2"],
      ["3241.50", "3.1"]
    ],
    "timestamp": 1765543493819
  }
}
```

---

## 🎨 Swagger UI Features

The interactive documentation at `/docs/api` provides:

- ✅ **Try It Out**: Test API endpoints directly from the browser
- ✅ **Request/Response Examples**: See sample payloads
- ✅ **Parameter Documentation**: Detailed parameter descriptions
- ✅ **Schema Validation**: Automatic request validation
- ✅ **Response Codes**: All possible HTTP response codes
- ✅ **Download Spec**: Export OpenAPI specification

---

## 🔧 Example Usage

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Get Aster assets
curl "http://localhost:3000/assets?exchange=aster"

# Get Hyperliquid ticker
curl "http://localhost:3000/ticker/ETH?exchange=hyperliquid"

# Search for Bitcoin
curl "http://localhost:3000/assets/search?q=BTC"

# Get orderbook with custom depth
curl "http://localhost:3000/orderbook/ETHUSDT?exchange=aster&depth=10"
```

### Using JavaScript/TypeScript

```typescript
// Fetch ticker data
const response = await fetch(
  'http://localhost:3000/ticker/ETHUSDT?exchange=aster'
);
const data = await response.json();
console.log('ETH Price:', data.data.price);

// Search assets
const searchResponse = await fetch('http://localhost:3000/assets/search?q=ETH');
const searchData = await searchResponse.json();
console.log('Aster results:', searchData.data.aster);
console.log('Hyperliquid results:', searchData.data.hyperliquid);
```

### Using Python

```python
import requests

# Get ticker
response = requests.get(
    'http://localhost:3000/ticker/ETH',
    params={'exchange': 'hyperliquid'}
)
data = response.json()
print(f"ETH Price: {data['data']['price']}")

# Get orderbook
orderbook = requests.get(
    'http://localhost:3000/orderbook/ETHUSDT',
    params={'exchange': 'aster', 'depth': 10}
)
print(f"Best bid: {orderbook.json()['data']['bids'][0]}")
```

---

## 📊 Response Format

All endpoints return JSON with a consistent structure:

### Success Response

```json
{
  "success": true,
  "exchange": "aster",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here"
}
```

---

## 🌐 Supported Exchanges

### Aster

- **Symbol Format**: `ETHUSDT`, `BTCUSDT`
- **Features**: Full futures trading support
- **Margin Modes**: CROSS, ISOLATED
- **Max Leverage**: Varies by asset

### Hyperliquid

- **Symbol Format**: `ETH`, `BTC`
- **Features**: Perpetual contracts
- **Margin Mode**: CROSS (default)
- **Max Leverage**: Up to 50x

---

## 🔐 Rate Limiting

Currently, there are no rate limits on public endpoints. However, please be respectful:

- **Recommended**: Max 10 requests/second
- **Burst**: Max 50 requests/minute

---

## 🎯 Best Practices

1. **Always check `success` field** in responses
2. **Handle errors gracefully** with try-catch
3. **Use appropriate exchange** for your symbols
4. **Cache asset lists** to reduce API calls
5. **Implement exponential backoff** for retries

---

## 📱 Integration Examples

### React/Next.js

```typescript
import { useState, useEffect } from 'react';

function TickerDisplay() {
  const [price, setPrice] = useState('');

  useEffect(() => {
    const fetchPrice = async () => {
      const res = await fetch(
        'http://localhost:3000/ticker/ETHUSDT?exchange=aster'
      );
      const data = await res.json();
      if (data.success) {
        setPrice(data.data.price);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, []);

  return <div>ETH Price: ${price}</div>;
}
```

### Vue.js

```vue
<template>
  <div>ETH Price: ${{ price }}</div>
</template>

<script>
export default {
  data() {
    return { price: '' };
  },
  async mounted() {
    const res = await fetch(
      'http://localhost:3000/ticker/ETH?exchange=hyperliquid'
    );
    const data = await res.json();
    this.price = data.data.price;
  },
};
</script>
```

---

## 🚀 Quick Start

1. **Start the server**:

   ```bash
   bun run server:docs
   ```

2. **Open documentation**:

   ```
   http://localhost:3000/docs/api
   ```

3. **Try an endpoint**:

   ```bash
   curl http://localhost:3000/health
   ```

4. **Explore the Swagger UI** and test all endpoints interactively!

---

## 📞 Support

For issues or questions:

- Check the interactive docs at `/docs/api`
- Review the OpenAPI spec at `/openapi.json`
- Test endpoints using the Swagger UI

**Happy Trading! 🎉**
