# Manual Testing Guide - Leverage Sync & Cancel All

## ✅ What We Built

1. **Cancel All Orders** - Fixed for both exchanges
2. **Get Leverage** - Fetch current leverage from exchange
3. **Leverage Sync** - Ensure bot and exchange show same values

## 🧪 How to Test

### Test 1: Cancel All Orders

**Steps:**

1. Start the bot: `./auto-start.sh`
2. Link an exchange (Aster or Hyperliquid)
3. Place 2-3 test orders
4. In Telegram bot, go to Orders List
5. Click "❌ Cancel All"
6. Click "✅ Yes, Cancel All"

**Expected Result:**

```
✅ Successfully cancelled 3 order(s)!
```

**Verify:**

- Check exchange dashboard - all orders should be cancelled
- Count should match number of orders

---

### Test 2: Get Leverage (Manual via Dashboard)

**Steps:**

1. Go to Aster/Hyperliquid dashboard
2. Set leverage to 3x for BTC
3. In bot, open BTC position screen
4. Check leverage displayed

**Expected Result:**

- Bot should show "Leverage: 3x"
- Should match dashboard exactly

---

### Test 3: Set Leverage from Bot

**Steps:**

1. In bot, go to BTC trading screen
2. Click "⚙️ Leverage"
3. Select "5x"
4. Confirm

**Expected Result:**

```
✅ Leverage set to 5x for BTC
```

**Verify:**

- Check exchange dashboard
- Should show 5x leverage
- Place order - should use 5x

---

### Test 4: Leverage Sync (Bi-directional)

**Scenario A: Dashboard → Bot**

1. Set 10x on exchange dashboard
2. Open bot position screen
3. Should show 10x

**Scenario B: Bot → Dashboard**

1. Set 2x in bot
2. Check exchange dashboard
3. Should show 2x

---

## 📊 Test Results Template

| Test               | Exchange    | Expected           | Actual | Status |
| ------------------ | ----------- | ------------------ | ------ | ------ |
| Cancel All         | Aster       | 3 orders cancelled | ?      | ⏳     |
| Cancel All         | Hyperliquid | 2 orders cancelled | ?      | ⏳     |
| Get Leverage       | Aster       | 3x                 | ?      | ⏳     |
| Get Leverage       | Hyperliquid | 5x                 | ?      | ⏳     |
| Set Leverage       | Aster       | 10x                | ?      | ⏳     |
| Set Leverage       | Hyperliquid | 10x                | ?      | ⏳     |
| Sync Dashboard→Bot | Aster       | Matches            | ?      | ⏳     |
| Sync Bot→Dashboard | Hyperliquid | Matches            | ?      | ⏳     |

---

## 🐛 Known Issues to Watch For

1. **Leverage Mismatch**: If bot shows different leverage than dashboard

   - Check: Is there an open position?
   - Fix: Close position and try again

2. **Cancel All Shows 0**: If no orders to cancel

   - Expected: "No open orders to cancel"
   - This is correct behavior

3. **Leverage Defaults to 1x**: If no position exists
   - Expected: Returns 1x as default
   - This is correct behavior

---

## 🚀 Quick Test Script

Run this to verify methods exist:

```bash
bun test-leverage-sync.js
```

Expected output:

```
✅ UniversalApiService loaded
✅ getLeverage() method exists
✅ cancelAllOrders() method exists
```

---

## 📝 Report Issues

If you find issues, note:

1. Which exchange (Aster/Hyperliquid)
2. What you did
3. Expected vs Actual result
4. Screenshots if possible
