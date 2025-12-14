# 🚀 Universal Trading API

A unified REST API for trading across multiple exchanges (Aster, Hyperliquid) with a single, consistent interface.

## ✨ Features

- **Multi-Exchange Support**: Aster & Hyperliquid with unified API
- **Comprehensive Trading**: Orders, positions, leverage, margin modes
- **Real-time Market Data**: Tickers, orderbooks, asset search
- **Session Management**: Secure token-based authentication

## 🎯 Quick Start

### Prerequisites

- [Bun](https://bun.sh) or Node.js
- Supabase account (free tier works)
- Exchange API credentials (Aster/Hyperliquid)

### 1. Setup

```bash
# Clone and install
git clone <your-repo>
cd AgentiFi-dev
bun install  # or npm install

# Run automated setup
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Configure Environment

The setup script creates `.env` from `.env.example`. Update these required values:

```bash
# Supabase (Get from https://supabase.com/dashboard)
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true

# Exchange API Keys
ASTER_API_KEY=your_aster_api_key
ASTER_API_SECRET=your_aster_api_secret
HYPERLIQUID_PRIVATE_KEY=your_hyperliquid_private_key
HYPERLIQUID_ADDRESS=your_hyperliquid_address

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_32_character_encryption_key
```

### 3. Initialize Database

The database schema is automatically created on first connection. Only 2 tables are used:

- `users` - User accounts
- `api_credentials` - Encrypted exchange credentials

### 4. Start Server

```bash
bun start  # Starts on http://localhost:3000
```

## 📡 API Endpoints

### Authentication

```bash
# Create session
POST /auth/session
Body: { "userId": "123", "exchangeId": "aster" }

# Delete session
DELETE /auth/session
Headers: { "Authorization": "Bearer <token>" }
```

### Trading

```bash
# Place order
POST /order
Body: {
  "symbol": "ETHUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": 0.1,
  "price": 3000,
  "exchange": "aster"
}

# Cancel order
DELETE /order/:orderId?exchange=aster

# Cancel all orders
DELETE /orders?symbol=ETHUSDT&exchange=aster

# Get open orders
GET /orders?exchange=aster

# Get order history
GET /orders/history?exchange=aster&limit=50
```

### Account Management

```bash
# Get account info
GET /account?exchange=aster

# Set leverage
POST /account/leverage
Body: { "symbol": "ETHUSDT", "leverage": 10, "exchange": "aster" }

# Set margin mode
POST /account/margin-mode
Body: { "symbol": "ETHUSDT", "mode": "ISOLATED", "exchange": "aster" }

# Get positions
GET /positions?exchange=aster
```

### Market Data (Public)

```bash
# Get ticker
GET /ticker/ETHUSDT?exchange=aster

# Get orderbook
GET /orderbook/ETHUSDT?exchange=aster&depth=10

# List assets
GET /assets?exchange=aster

# Search assets across exchanges
GET /assets/search?q=ETH
```

## 🧪 Testing

```bash
# Basic API tests
bun run test:api

# Robust error handling tests
bun run test:api:robust

# Comprehensive live trading tests
bun src/live-test-universal.ts
```

## 🛠️ Database Management

### Backup Database

```bash
./scripts/backup-db.sh
# Creates timestamped backup in backups/
```

### Update Database

```bash
./scripts/update-db.sh
# Interactive menu to apply SQL updates
```

## 🏗️ Architecture

### Cloud-Only Design

- **Database**: Supabase PostgreSQL (cloud-hosted)
- **Session Store**: In-memory (production: use Redis)
- **No Local Dependencies**: Zero local database setup required

### Security

- API credentials encrypted at rest
- Session-based authentication
- CORS enabled for web clients

## 📚 Available Test Files

- `src/universal-api.test.ts` - Basic connectivity tests
- `src/api-robust.test.ts` - Error handling & edge cases
- `src/live-test-universal.ts` - Full trading flow tests
- `src/live-test-aster.ts` - Aster-specific tests
- `src/live-test-hyperliquid.ts` - Hyperliquid-specific tests

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
docker run --rm postgres:15 psql "$DATABASE_URL" -c "SELECT 1;"
```

### API Not Starting

```bash
# Check if port 3000 is available
lsof -i :3000

# View server logs
tail -f server.log
```

## 📖 Documentation

### 📮 Postman Collection

**Universal Trading API v1.0** - Complete collection with all endpoints and order types tested.

#### 📥 Download & Import

**Option 1: Direct Download**

- **Location:** [`docs/Universal_API.postman_collection.json`](./docs/Universal_API.postman_collection.json)
- **Size:** ~22 KB
- **Import:** Postman → Import → Select file

**Option 2: View Interactive Docs**

- **HTML Documentation:** [`docs/index.html`](./docs/index.html)
- **Features:** Dark theme, sidebar navigation, code examples
- **Open:** `open docs/index.html` (or double-click the file)

#### ✨ Collection Features

**24 API Endpoints Documented:**

- 👤 **User Management** (4 endpoints)
  - Create user, link credentials, list exchanges
- 🔐 **Authentication** (2 endpoints)
  - Create/delete sessions with token management
- 📈 **Market Data** (3 endpoints)
  - Assets, tickers, orderbooks (public access)
- 💼 **Account Management** (4 endpoints)
  - Account info, positions, leverage, margin mode
- 📝 **Order Placement** (8 order types)
  - LIMIT, MARKET, IOC, POST_ONLY
  - STOP_MARKET, STOP_LIMIT, TAKE_PROFIT_MARKET
  - TRAILING_STOP (Aster only)
- 🔧 **Order Management** (3 endpoints)
  - Get orders, cancel order, cancel all orders

#### 🎯 Test Results

**Verified with 100% API Functionality:**

- ✅ **Aster Exchange:** 10/10 tests passing (100%)
- ✅ **Hyperliquid Exchange:** 100% API functionality
- ✅ **All Order Types:** Tested and working
- ✅ **MARKET Orders:** Supported on both exchanges
- ✅ **IOC Orders:** Fully functional

**Note:** Hyperliquid implements MARKET orders as aggressive IOC limit orders (±5% from market price).

#### 🚀 Quick Start with Postman

1. **Import Collection**
   ```bash
   # Download the collection
   curl -O https://raw.githubusercontent.com/NitinBag0riya/agentiicc-term/master/docs/Universal_API.postman_collection.json
   ```
2. **Set Variables**

   - `baseUrl`: `http://localhost:3000` (or your server URL)
   - `userId`: Your user ID (auto-set after creating user)
   - `authToken`: Your session token (auto-set after auth)
   - `exchangeId`: `aster` or `hyperliquid`

3. **Start Testing**
   - Run "Create User" → auto-sets `userId`
   - Run "Create Session" → auto-sets `authToken`
   - Test any endpoint!

#### 📊 Order Type Examples

**LIMIT Order:**

```json
{
  "symbol": "ETHUSDT",
  "side": "BUY",
  "type": "LIMIT",
  "quantity": "0.01",
  "price": "3000",
  "exchange": "aster"
}
```

**MARKET Order:**

```json
{
  "symbol": "ETHUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quantity": "0.01",
  "exchange": "hyperliquid"
}
```

**STOP_LIMIT Order:**

```json
{
  "symbol": "ETHUSDT",
  "side": "SELL",
  "type": "STOP_LIMIT",
  "quantity": "0.01",
  "triggerPrice": "2900",
  "price": "2850",
  "exchange": "aster"
}
```

### 📚 Additional Resources

- [Setup Guide](./scripts/setup.sh) - Automated setup script
- [Database Schema](./supabase/migrations/20251213_fresh_init.sql) - Minimal schema
- [Test Reports](./FINAL_TEST_REPORT.md) - Comprehensive test results
- [API Server](./src/api/server.ts) - Core API implementation

## 🚀 Production Deployment

1. Set production environment variables
2. Use Redis for session storage (update `src/middleware/session.ts`)
3. Enable rate limiting
4. Set up monitoring & logging
5. Use HTTPS/TLS

## 📝 License

MIT
