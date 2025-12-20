# Telegram Mini App - Aster DEX Wallet Linking

This is the Telegram Mini App for linking wallets to the Aster DEX trading bot.

**Features:**
- ✅ WalletConnect v2 integration with proper Telegram deep link handling
- ✅ MetaMask, Trust Wallet, and other wallet support
- ✅ Mobile-optimized with QR code modal
- ✅ Proper `window.open` override for Telegram Mini App environment

## Setup

### 1. Get WalletConnect Project ID

1. Go to https://cloud.walletconnect.com
2. Create a free account
3. Create a new project
4. Copy your Project ID

### 2. Configure Project ID

Edit `app.js` and replace `YOUR_PROJECT_ID_HERE` with your actual WalletConnect Project ID:

```javascript
const WALLETCONNECT_PROJECT_ID = 'your-actual-project-id-here';
```

## Deployment

We have two separate Cloudflare Pages deployments:

### Development (Ngrok Backend)
- **Project:** `xk7p-static-cdn-v2-prod`
- **URL:** https://xk7p-static-cdn-v2-prod.pages.dev
- **Backend:** https://86547dc93752.ngrok-free.app
- **Config:** `wrangler.dev.toml`
- **Deploy:** `npm run deploy:dev`

### Production
- **Project:** `zr9m-asset-delivery-v4-prod`
- **URL:** https://zr9m-asset-delivery-v4-prod.pages.dev
- **Backend:** https://inc.engineering-services.solidterminal.com
- **Config:** `wrangler.prod.toml`
- **Deploy:** `npm run deploy:prod`

## How It Works

Both deployments are **identical applications**, they just point to different backend URLs:

1. User opens Mini App in Telegram
2. User clicks "Connect Wallet"
   - On Desktop: QR code modal appears
   - On Mobile: Deep link opens wallet app (MetaMask, Trust, etc.)
3. User connects wallet and signs message
4. Mini App sends to Cloudflare Function at `/tgma/create-api-key`
5. Cloudflare Function proxies to backend (dev or prod)
6. Backend verifies Telegram auth and wallet signature
7. Backend calls Aster DEX API to create API keys
8. Backend stores encrypted credentials in database
9. Success message shown, Mini App closes

### Technical Details

**WalletConnect v2 Integration:**
- Uses `@walletconnect/ethereum-provider` v2.13.0
- Proper deep link handling for Telegram Mini App environment
- Overrides `window.open` to use `Telegram.WebApp.openLink()`
- Converts wallet deep links (`metamask://`, `trust://`) to universal links
- 2-minute timeout for connection and signing to prevent infinite loading

**Telegram Mini App Compatibility:**
- Detects Telegram environment and adjusts behavior
- Uses `TelegramWebviewProxy` for older clients
- Respects Telegram theme colors
- Proper error handling with user-friendly messages

## Configuration Files

- `wrangler.dev.toml` - Development config (ngrok backend)
- `wrangler.prod.toml` - Production config (production backend)
- `wrangler.toml` - **Generated** (copied from .dev or .prod during deployment)

**Note:** `wrangler.toml` is gitignored and generated at deploy time.

## Local Development

```bash
npm run dev
```

This will start a local development server on http://localhost:8788

## Backend Integration

The Mini App expects a backend endpoint at:
- **Development:** `https://86547dc93752.ngrok-free.app/tgma/create-api-key`
- **Production:** `https://inc.engineering-services.solidterminal.com/tgma/create-api-key`

The backend must:
1. Verify Telegram initData signature
2. Call Aster DEX API to create keys
3. Store encrypted credentials
4. Update user session

## Environment Variables

Both deployments use the same environment variable:

- `BACKEND_URL` - Set in `wrangler.dev.toml` or `wrangler.prod.toml`

## Files

- `index.html` - Main Mini App page
- `style.css` - Styles (respects Telegram theme)
- `app.js` - Frontend logic (wallet connection, signing)
- `functions/tgma/create-api-key.ts` - Cloudflare Function (proxy to backend)
