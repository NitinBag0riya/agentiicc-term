# Bot CTA Testing Plan

## Objective

Rigorous testing of all bot CTAs and user flows for both Aster and Hyperliquid exchanges.

---

## Test Categories

### 1. Onboarding Flow

| #   | Test                               | Expected Result                |
| --- | ---------------------------------- | ------------------------------ |
| 1.1 | `/start` without referral code     | Show referral required message |
| 1.2 | `/start VALID_CODE`                | Create account, show Citadel   |
| 1.3 | `/start INVALID_CODE`              | Show invalid code error        |
| 1.4 | Link Aster via WalletConnect       | Redirect to mini app           |
| 1.5 | Link Hyperliquid via WalletConnect | Redirect to mini app           |

### 2. Navigation CTAs

| #   | CTA                 | Expected Result             |
| --- | ------------------- | --------------------------- |
| 2.1 | `/menu`             | Show Citadel overview       |
| 2.2 | `/help`             | Show help message           |
| 2.3 | `/settings`         | Show settings menu          |
| 2.4 | Type `BTC` (search) | Show BTC position interface |
| 2.5 | Type `ETH` (search) | Show ETH position interface |
| 2.6 | Back button         | Return to previous screen   |

### 3. Position Interface CTAs (Per Exchange)

| #    | CTA             | Exchange    | Expected Result                   |
| ---- | --------------- | ----------- | --------------------------------- |
| 3.1  | Long $50        | Aster       | Launch wizard with $50 prefilled  |
| 3.2  | Long $200       | Aster       | Launch wizard with $200 prefilled |
| 3.3  | Long X (custom) | Aster       | Launch wizard, ask for amount     |
| 3.4  | Short $50       | Aster       | Launch wizard with $50            |
| 3.5  | Short X         | Aster       | Launch wizard                     |
| 3.6  | Close 25%       | Aster       | Close 25% of position             |
| 3.7  | Close 50%       | Aster       | Close 50% of position             |
| 3.8  | Close 100%      | Aster       | Close entire position             |
| 3.9  | Long $50        | Hyperliquid | Launch wizard with $50            |
| 3.10 | Long $200       | Hyperliquid | Launch wizard with $200           |
| 3.11 | Short $50       | Hyperliquid | Launch wizard with $50            |
| 3.12 | Short X         | Hyperliquid | Launch wizard                     |
| 3.13 | Close 25%       | Hyperliquid | Close 25% of position             |
| 3.14 | Close 50%       | Hyperliquid | Close 50% of position             |
| 3.15 | Close 100%      | Hyperliquid | Close entire position             |

### 4. Order Type Toggle

| #   | Test                | Expected Result                   |
| --- | ------------------- | --------------------------------- |
| 4.1 | Toggle Market/Limit | Switch order type, update buttons |
| 4.2 | Market order wizard | Ask amount only                   |
| 4.3 | Limit order wizard  | Ask amount + price                |

### 5. Leverage & Margin CTAs

| #   | CTA                   | Expected Result           |
| --- | --------------------- | ------------------------- |
| 5.1 | ⚙️ Settings button    | Show leverage/margin menu |
| 5.2 | Leverage 5x           | Set leverage to 5x        |
| 5.3 | Leverage 10x          | Set leverage to 10x       |
| 5.4 | Custom leverage       | Ask for custom value      |
| 5.5 | Cross/Isolated toggle | Switch margin mode        |

### 6. TP/SL CTAs

| #    | CTA       | Exchange    | Expected Result        |
| ---- | --------- | ----------- | ---------------------- |
| 6.1  | Set TP    | Aster       | Launch TP wizard       |
| 6.2  | Set SL    | Aster       | Launch SL wizard       |
| 6.3  | Set TP+SL | Aster       | Launch combined wizard |
| 6.4  | Cancel TP | Aster       | Remove take profit     |
| 6.5  | Cancel SL | Aster       | Remove stop loss       |
| 6.6  | Set TP    | Hyperliquid | Launch TP wizard       |
| 6.7  | Set SL    | Hyperliquid | Launch SL wizard       |
| 6.8  | Set TP+SL | Hyperliquid | Launch combined wizard |
| 6.9  | Cancel TP | Hyperliquid | Remove take profit     |
| 6.10 | Cancel SL | Hyperliquid | Remove stop loss       |

### 7. Exchange Switching

| #   | Test                      | Expected Result                  |
| --- | ------------------------- | -------------------------------- |
| 7.1 | Switch to Hyperliquid     | Session updates, data refreshes  |
| 7.2 | Switch to Aster           | Session updates, data refreshes  |
| 7.3 | View Citadel after switch | Correct exchange positions shown |

### 8. Order Confirmation Flow

| #   | Test          | Expected Result             |
| --- | ------------- | --------------------------- |
| 8.1 | Confirm order | Execute order, show result  |
| 8.2 | Cancel order  | Cancel, return to position  |
| 8.3 | Recalculate   | Update prices, show updated |

### 9. Error Handling

| #   | Test                  | Expected Result    |
| --- | --------------------- | ------------------ |
| 9.1 | Invalid symbol        | Show error message |
| 9.2 | Insufficient balance  | Show balance error |
| 9.3 | Invalid amount format | Show format guide  |
| 9.4 | API timeout           | Show retry message |

---

## Automated Test Script

Run existing test suite:

```bash
npx ts-node test-position-orders.ts
```

## Manual Test Checklist

### Aster Exchange

- [ ] Open position (Long BTC)
- [ ] Close position (100%)
- [ ] Set leverage
- [ ] Set TP/SL
- [ ] Cancel order

### Hyperliquid Exchange

- [ ] Open position (Long HYPE)
- [ ] Close position (100%)
- [ ] Set leverage
- [ ] Verify symbol routing

---

## Critical Path Tests

1. **Onboarding → Citadel** - New user with referral
2. **Search → Trade → Close** - Full trade lifecycle
3. **Exchange Switch → Trade** - Cross-exchange operation
4. **Error Recovery** - Handle and recover from errors
