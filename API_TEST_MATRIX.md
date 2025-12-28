# API Test Matrix - Position Management & Order Placement

> **Last Updated:** 2025-12-28
> **Status:** Work in Progress
> **Exchanges:** Aster DEX, Hyperliquid

---

## Known Issues

### 1. Leverage Sync Issue ❌

- [ ] **Problem:** Leverage not synced bidirectionally between bot session and exchange
- [ ] **File:** `src/composers/futures-positions/interface.ts` (line 102-110)
- [ ] **Fix Required:** Refresh leverage from exchange after setting via bot

### 2. Ticker Price Sync Issue ⚠️

- [ ] **Problem:** Price caching only works for Aster, not Hyperliquid
- [ ] **File:** `src/services/priceCache.service.ts`
- [ ] **Fix Required:** Add Hyperliquid price polling

---

## Order Types Reference

| #   | Order Type             | Description                             | Price? | Trigger? |
| --- | ---------------------- | --------------------------------------- | ------ | -------- |
| 1   | `MARKET`               | Execute immediately at market price     | ❌     | ❌       |
| 2   | `LIMIT`                | Execute at specified price or better    | ✅     | ❌       |
| 3   | `STOP_MARKET`          | Market order when trigger price reached | ❌     | ✅       |
| 4   | `STOP_LIMIT`           | Limit order when trigger price reached  | ✅     | ✅       |
| 5   | `TAKE_PROFIT_MARKET`   | Close position at market when TP hit    | ❌     | ✅       |
| 6   | `TAKE_PROFIT_LIMIT`    | Close position at limit when TP hit     | ✅     | ✅       |
| 7   | `TRAILING_STOP_MARKET` | Trailing stop with callback rate        | ❌     | ✅       |
| 8   | `MARKET (reduceOnly)`  | Close existing position only            | ❌     | ❌       |

---

## Order Placement Tests

### Aster DEX

| Test # | Order Type           | Side | Status | Notes                   |
| ------ | -------------------- | ---- | ------ | ----------------------- |
| 1      | MARKET               | BUY  | [ ]    | Long position           |
| 2      | MARKET               | SELL | [ ]    | Short position          |
| 3      | LIMIT                | BUY  | [ ]    | Below market price      |
| 4      | LIMIT                | SELL | [ ]    | Above market price      |
| 5      | STOP_MARKET          | BUY  | [ ]    | Trigger above market    |
| 6      | STOP_MARKET          | SELL | [ ]    | Trigger below market    |
| 7      | STOP_LIMIT           | BUY  | [ ]    | Trigger + limit price   |
| 8      | STOP_LIMIT           | SELL | [ ]    | Trigger + limit price   |
| 9      | TAKE_PROFIT_MARKET   | BUY  | [ ]    | Close short at profit   |
| 10     | TAKE_PROFIT_MARKET   | SELL | [ ]    | Close long at profit    |
| 11     | TAKE_PROFIT_LIMIT    | BUY  | [ ]    | TP with limit execution |
| 12     | TAKE_PROFIT_LIMIT    | SELL | [ ]    | TP with limit execution |
| 13     | TRAILING_STOP_MARKET | BUY  | [ ]    | Trailing buy            |
| 14     | TRAILING_STOP_MARKET | SELL | [ ]    | Trailing sell           |
| 15     | MARKET (reduceOnly)  | BUY  | [ ]    | Close short position    |
| 16     | MARKET (reduceOnly)  | SELL | [ ]    | Close long position     |

### Hyperliquid

| Test # | Order Type           | Side | Status | Notes                   |
| ------ | -------------------- | ---- | ------ | ----------------------- |
| 17     | MARKET               | BUY  | [ ]    | Long position           |
| 18     | MARKET               | SELL | [ ]    | Short position          |
| 19     | LIMIT                | BUY  | [ ]    | Below market price      |
| 20     | LIMIT                | SELL | [ ]    | Above market price      |
| 21     | STOP_MARKET          | BUY  | [ ]    | Trigger above market    |
| 22     | STOP_MARKET          | SELL | [ ]    | Trigger below market    |
| 23     | STOP_LIMIT           | BUY  | [ ]    | Trigger + limit price   |
| 24     | STOP_LIMIT           | SELL | [ ]    | Trigger + limit price   |
| 25     | TAKE_PROFIT_MARKET   | BUY  | [ ]    | Close short at profit   |
| 26     | TAKE_PROFIT_MARKET   | SELL | [ ]    | Close long at profit    |
| 27     | TAKE_PROFIT_LIMIT    | BUY  | [ ]    | TP with limit execution |
| 28     | TAKE_PROFIT_LIMIT    | SELL | [ ]    | TP with limit execution |
| 29     | TRAILING_STOP_MARKET | BUY  | [ ]    | Trailing buy            |
| 30     | TRAILING_STOP_MARKET | SELL | [ ]    | Trailing sell           |
| 31     | MARKET (reduceOnly)  | BUY  | [ ]    | Close short position    |
| 32     | MARKET (reduceOnly)  | SELL | [ ]    | Close long position     |

---

## Position Management Tests

### Leverage Operations

| Test # | Operation        | Exchange    | Status | API Endpoint           |
| ------ | ---------------- | ----------- | ------ | ---------------------- |
| 33     | Set Leverage 5x  | Aster       | [ ]    | POST /account/leverage |
| 34     | Set Leverage 10x | Aster       | [ ]    | POST /account/leverage |
| 35     | Set Leverage 20x | Aster       | [ ]    | POST /account/leverage |
| 36     | Set Leverage 50x | Aster       | [ ]    | POST /account/leverage |
| 37     | Set Leverage 5x  | Hyperliquid | [ ]    | POST /account/leverage |
| 38     | Set Leverage 10x | Hyperliquid | [ ]    | POST /account/leverage |
| 39     | Set Leverage 20x | Hyperliquid | [ ]    | POST /account/leverage |
| 40     | Set Leverage 50x | Hyperliquid | [ ]    | POST /account/leverage |

### Margin Mode Operations

| Test # | Operation           | Exchange    | Status | API Endpoint              |
| ------ | ------------------- | ----------- | ------ | ------------------------- |
| 41     | Set Margin Cross    | Aster       | [ ]    | POST /account/margin-mode |
| 42     | Set Margin Isolated | Aster       | [ ]    | POST /account/margin-mode |
| 43     | Set Margin Cross    | Hyperliquid | [ ]    | N/A (cross only)          |

### TP/SL Operations

| Test # | Operation            | Exchange    | Status | API Endpoint               |
| ------ | -------------------- | ----------- | ------ | -------------------------- |
| 44     | Set Take Profit      | Aster       | [ ]    | POST /position/take-profit |
| 45     | Set Take Profit      | Hyperliquid | [ ]    | POST /position/take-profit |
| 46     | Set Stop Loss        | Aster       | [ ]    | POST /position/stop-loss   |
| 47     | Set Stop Loss        | Hyperliquid | [ ]    | POST /position/stop-loss   |
| 48     | Set TP + SL Combined | Aster       | [ ]    | POST /position/tp-sl       |
| 49     | Set TP + SL Combined | Hyperliquid | [ ]    | POST /position/tp-sl       |
| 50     | Modify Take Profit   | Aster       | [ ]    | Cancel + New Order         |
| 51     | Modify Stop Loss     | Aster       | [ ]    | Cancel + New Order         |
| 52     | Remove Take Profit   | Aster       | [ ]    | DELETE /order/:orderId     |
| 53     | Remove Stop Loss     | Aster       | [ ]    | DELETE /order/:orderId     |

### Position Close Operations

| Test # | Operation  | Exchange    | Status | API Endpoint             |
| ------ | ---------- | ----------- | ------ | ------------------------ |
| 54     | Close 25%  | Aster       | [ ]    | POST /order (reduceOnly) |
| 55     | Close 50%  | Aster       | [ ]    | POST /order (reduceOnly) |
| 56     | Close 69%  | Aster       | [ ]    | POST /order (reduceOnly) |
| 57     | Close 100% | Aster       | [ ]    | POST /order (reduceOnly) |
| 58     | Close 25%  | Hyperliquid | [ ]    | POST /order (reduceOnly) |
| 59     | Close 50%  | Hyperliquid | [ ]    | POST /order (reduceOnly) |
| 60     | Close 100% | Hyperliquid | [ ]    | POST /order (reduceOnly) |

### Margin Management (Isolated Mode)

| Test # | Operation     | Exchange | Status | API Endpoint          |
| ------ | ------------- | -------- | ------ | --------------------- |
| 61     | Add Margin    | Aster    | [ ]    | POST /position/margin |
| 62     | Remove Margin | Aster    | [ ]    | POST /position/margin |

### Order Management

| Test # | Operation           | Exchange    | Status | API Endpoint           |
| ------ | ------------------- | ----------- | ------ | ---------------------- |
| 63     | Get Open Orders     | Aster       | [ ]    | GET /orders            |
| 64     | Get Open Orders     | Hyperliquid | [ ]    | GET /orders            |
| 65     | Cancel Single Order | Aster       | [ ]    | DELETE /order/:orderId |
| 66     | Cancel Single Order | Hyperliquid | [ ]    | DELETE /order/:orderId |
| 67     | Cancel All Orders   | Aster       | [ ]    | DELETE /orders         |
| 68     | Cancel All Orders   | Hyperliquid | [ ]    | DELETE /orders         |
| 69     | Get Order History   | Aster       | [ ]    | GET /orders/history    |
| 70     | Get Order History   | Hyperliquid | [ ]    | GET /orders/history    |
| 71     | Get Fills/Trades    | Aster       | [ ]    | GET /fills             |
| 72     | Get Fills/Trades    | Hyperliquid | [ ]    | GET /fills             |

---

## Bot CTA → API Mapping

| CTA Button          | Action Pattern                     | API Endpoint                 |
| ------------------- | ---------------------------------- | ---------------------------- |
| `🔄 Market/Limit`   | `pos_toggle_ordertype:{symbol}`    | Session only (no API)        |
| `5x/10x/20x`        | `pos_leverage_menu:{symbol}`       | POST /account/leverage       |
| `🔄 Cross/Isolated` | `pos_toggle_margin:{symbol}`       | POST /account/margin-mode    |
| `Long $50`          | `pos_long:{symbol}:50`             | POST /order                  |
| `Long X`            | `pos_long_custom:{symbol}`         | POST /order                  |
| `Short $50`         | `pos_short:{symbol}:50`            | POST /order                  |
| `Short X`           | `pos_short_custom:{symbol}`        | POST /order                  |
| `Ape $50`           | `pos_ape:{symbol}:50`              | POST /order                  |
| `Close All`         | `pos_close:{symbol}:100`           | POST /order (reduceOnly)     |
| `Sell 25%`          | `pos_close:{symbol}:25`            | POST /order (reduceOnly)     |
| `Sell 69%`          | `pos_close:{symbol}:69`            | POST /order (reduceOnly)     |
| `🎯 Set TP/SL`      | `pos_tpsl_mode:{symbol}`           | Shows TP/SL buttons          |
| `Set TP`            | `pos_tpsl_set_tp:{symbol}`         | POST /position/take-profit   |
| `Set SL`            | `pos_tpsl_set_sl:{symbol}`         | POST /position/stop-loss     |
| `Set Both`          | `pos_tpsl_set_both:{symbol}`       | POST /position/tp-sl         |
| `Modify TP`         | `pos_tpsl_modify_tp:{symbol}`      | Cancel + New Order           |
| `Remove TP`         | `pos_tpsl_remove_tp:{symbol}:{id}` | DELETE /order/:orderId       |
| `📋 Manage Orders`  | `pos_manage_orders:{symbol}`       | GET /orders                  |
| `Cancel All`        | `pos_cancel_all:{symbol}`          | DELETE /orders               |
| `Cancel X`          | `pos_cancel_custom:{symbol}`       | DELETE /order/:orderId       |
| `🔄 Refresh`        | `pos_refresh:{symbol}`             | GET /positions + GET /orders |

---

## Account & Session Tests

| Test # | Operation                     | Status | API Endpoint                      |
| ------ | ----------------------------- | ------ | --------------------------------- |
| 73     | Health Check                  | [ ]    | GET /health                       |
| 74     | Create User                   | [ ]    | POST /user                        |
| 75     | Store Aster Credentials       | [ ]    | POST /user/credentials            |
| 76     | Store Hyperliquid Credentials | [ ]    | POST /user/credentials            |
| 77     | Get Linked Exchanges          | [ ]    | GET /user/exchanges               |
| 78     | Create Session                | [ ]    | POST /auth/session                |
| 79     | Get Session Info              | [ ]    | GET /auth/session/info            |
| 80     | Switch Exchange               | [ ]    | POST /auth/session/switch         |
| 81     | Delete Session                | [ ]    | DELETE /auth/session              |
| 82     | Get Account (Aster)           | [ ]    | GET /account?exchange=aster       |
| 83     | Get Account (Hyperliquid)     | [ ]    | GET /account?exchange=hyperliquid |

---

## Market Data Tests (Public APIs)

| Test # | Operation     | Exchange    | Status | API Endpoint             |
| ------ | ------------- | ----------- | ------ | ------------------------ |
| 84     | Get Assets    | Aster       | [ ]    | GET /assets              |
| 85     | Get Assets    | Hyperliquid | [ ]    | GET /assets              |
| 86     | Search Assets | Both        | [ ]    | GET /assets/search?q=BTC |
| 87     | Get Ticker    | Aster       | [ ]    | GET /ticker/BTCUSDT      |
| 88     | Get Ticker    | Hyperliquid | [ ]    | GET /ticker/BTC          |
| 89     | Get Orderbook | Aster       | [ ]    | GET /orderbook/BTCUSDT   |
| 90     | Get Orderbook | Hyperliquid | [ ]    | GET /orderbook/BTC       |
| 91     | Get OHLCV     | Aster       | [ ]    | GET /ohlcv/BTCUSDT       |
| 92     | Get OHLCV     | Hyperliquid | [ ]    | GET /ohlcv/BTC           |

---

## Summary

| Category            | Total Tests | Passed | Failed | Pending |
| ------------------- | ----------- | ------ | ------ | ------- |
| Order Placement     | 32          | 0      | 0      | 32      |
| Position Management | 40          | 0      | 0      | 40      |
| Account & Session   | 11          | 0      | 0      | 11      |
| Market Data         | 9           | 0      | 0      | 9       |
| **TOTAL**           | **92**      | **0**  | **0**  | **92**  |

---

## Test Execution Log

### Date: \_**\_-**-\_\_

**Tester:** ****\_\_\_\_****

**Notes:**

```
Add your test notes here...
```

**Failures:**

```
Document any failures here...
```
