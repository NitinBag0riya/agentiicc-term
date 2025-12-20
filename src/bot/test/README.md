# Real Recursive Bot Testing

## Setup

1. Add your Telegram user ID to `.env`:

```bash
TEST_CHAT_ID=your_telegram_user_id
```

To get your Telegram user ID:

- Message @userinfobot on Telegram
- It will reply with your user ID

2. Make sure your bot is running:

```bash
# Terminal 1
bun src/index.ts
```

## Run the Test

```bash
bun src/bot/test/real-recursive-test.ts
```

## What It Does

1. **Sends `/start`** to your bot
2. **Extracts all buttons** from the response
3. **Clicks each button** recursively
4. **Discovers new screens** and their buttons
5. **Tests every CTA** across all screens
6. **Generates a report** with:
   - Total CTAs tested
   - Pass/fail rate
   - Buttons discovered per screen
   - Complete navigation map

## Example Output

```
🚀 Recursive Bot CTA Tester
══════════════════════════════════════════════════════════════════════
Bot Token: ✅ Set
Test Chat ID: 123456789
══════════════════════════════════════════════════════════════════════

📍 Testing: /start
  ✅ Found 2 buttons
     - Menu (menu)
     - Link Exchange (link_exchange)

🔘 Testing: menu (from start)
  ✅ Found 4 buttons
     - Citadel (citadel)
     - Settings (settings)
     - Trading (trading)
     - Unlink (unlink_exchange)

🔘 Testing: citadel (from menu)
  ✅ Found 3 buttons
     - Positions (positions)
     - Assets (assets)
     - Back (menu)

... continues recursively ...

📊 RECURSIVE TEST REPORT
══════════════════════════════════════════════════════════════════════
Total CTAs Tested: 45
Passed: 43 ✅
Failed: 2 ❌
Pass Rate: 95.6%
Total Buttons Discovered: 127
Screens Visited: 8
══════════════════════════════════════════════════════════════════════
```

## Safety Features

- **Max 50 iterations** to prevent infinite loops
- **Rate limiting** (500ms between tests)
- **Visited tracking** to avoid testing same CTA twice

## Note

This test will actually send messages to your Telegram chat. Use a test account or be prepared to see test messages in your chat with the bot.
