# How to Get Your Telegram Chat ID

## Quick Steps

1. Open Telegram
2. Search for and message: **@userinfobot**
3. It will reply with your user ID (looks like: `123456789`)
4. Copy that number

## Update .env File

Replace this line in `.env`:

```
TEST_CHAT_ID=7797429783
```

With your actual ID:

```
TEST_CHAT_ID=123456789
```

## Run the Recursive Test

```bash
bun src/bot/test/real-recursive-test.ts
```

This will automatically:

- ✅ Send `/start` to @My_Test_Tradeee_bot
- ✅ Extract all buttons
- ✅ Click each button recursively
- ✅ Test every screen and CTA
- ✅ Generate complete test report

## Alternative: Manual Testing

Just open Telegram and test manually:

1. Send `/start` to @My_Test_Tradeee_bot
2. Click through all buttons
3. Test all features

This is often faster and easier than automated testing!
