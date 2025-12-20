# Quick Testing Guide

## The Problem with the Previous Test

The `run-full-test.ts` script failed because it tried to simulate bot interactions without the bot actually running. It's like trying to test a car by imagining driving it instead of actually starting the engine.

## What Actually Works

### 1. Integration Test (Automated)

Tests the **real** running services:

```bash
# Make sure API server is running first
bun src/server-bun.ts

# Then run integration test
bun src/bot/test/integration-test.ts
```

**What it tests**:

- ✅ API health check
- ✅ Get assets endpoint
- ✅ Search assets
- ✅ Bot info via Telegram API
- ✅ Webhook status

### 2. Manual Bot Testing (Most Reliable)

Open Telegram and test the bot directly:

1. Send `/start` to your bot
2. Click through all menus
3. Test each feature:
   - View positions
   - Manage margin
   - Set leverage
   - Set TP/SL
   - Place orders
   - Cancel orders

### 3. API Testing with Postman

Use the `Universal_API.postman_collection.json`:

1. Import into Postman
2. Set environment variables
3. Test each endpoint manually

## Why This Approach Works Better

**Previous approach** (run-full-test.ts):

- ❌ Tried to mock everything
- ❌ No real bot running
- ❌ Complex setup
- ❌ Didn't actually test anything

**New approach** (integration-test.ts):

- ✅ Tests real running services
- ✅ Simple HTTP requests
- ✅ Actual API calls
- ✅ Real results

## Quick Test Commands

```bash
# Test API only
curl http://localhost:3000/health

# Test bot info
curl https://api.telegram.org/bot${BOT_TOKEN}/getMe

# Run full integration test
bun src/bot/test/integration-test.ts
```

## What to Test Manually

Since the bot is a Telegram interface, the best testing is **manual**:

1. **Commands**: `/start`, `/menu`, `/settings`
2. **Navigation**: Click all buttons, verify they work
3. **Trading**: Try placing a small test order
4. **Position Management**: Test TP/SL, leverage, margin
5. **Error Handling**: Try invalid inputs

## Bottom Line

**For automated testing**: Use `integration-test.ts` to verify services are running

**For bot testing**: Use Telegram manually - it's faster and more reliable than trying to automate UI testing
