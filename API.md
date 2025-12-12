# API Documentation

## Overview

The AgentiFi-dev API provides secure access to exchange account information through a unified interface.

## Authentication

### Create Session

```bash
POST /auth/session
Content-Type: application/json

{
  "userId": 1,
  "exchangeId": "aster"  # or "hyperliquid"
}
```

**Response:**

```json
{
  "success": true,
  "token": "session-token-here",
  "message": "Session created successfully"
}
```

### Use Session Token

Include the token in requests:

```bash
Authorization: Bearer <token>
```

## Endpoints

### GET /account

Get account information from the linked exchange.

**Headers:**

```
Authorization: Bearer <session-token>
```

**Response (Success):**

```json
{
  "success": true,
  "data": {
    "exchange": "aster",
    "totalBalance": "1000.50",
    "availableBalance": "750.25",
    "positions": [
      {
        "symbol": "BTCUSDT",
        "size": "0.5",
        "entryPrice": "45000",
        "markPrice": "46000",
        "unrealizedPnl": "500.00",
        "side": "LONG"
      }
    ],
    "timestamp": 1702345678901
  }
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Error message"
}
```

### DELETE /auth/session

Logout and invalidate session.

**Headers:**

```
Authorization: Bearer <session-token>
```

**Response:**

```json
{
  "success": true,
  "message": "Session deleted"
}
```

### GET /health

Health check endpoint (no auth required).

**Response:**

```json
{
  "status": "ok",
  "timestamp": 1702345678901
}
```

## Example Usage

```bash
# 1. Create a session (after linking exchange via Telegram bot)
curl -X POST http://localhost:3000/auth/session \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "exchangeId": "aster"}'

# 2. Get account info
curl http://localhost:3000/account \
  -H "Authorization: Bearer <your-token>"

# 3. Logout
curl -X DELETE http://localhost:3000/auth/session \
  -H "Authorization: Bearer <your-token>"
```

## Security

- ✅ **No Direct Exchange Access**: Users cannot bypass the API to call Aster/Hyperliquid directly
- ✅ **Session-based Auth**: All requests require valid session tokens
- ✅ **Encrypted Credentials**: Exchange credentials are stored encrypted in PostgreSQL
- ✅ **Adapter Pattern**: Exchange-specific logic is isolated in adapters
- ✅ **Auto-expiring Sessions**: Sessions expire after 24 hours

## Architecture

```
User Request → Auth Middleware → Adapter Factory → Exchange Adapter → Exchange API
                                        ↓
                                 Session Store
                                        ↓
                                    Database
```

## Notes

- Sessions are stored in-memory (use Redis for production)
- userId must correspond to a user who has linked credentials via the Telegram bot
- exchangeId must match the linked exchange ('aster' or 'hyperliquid')
