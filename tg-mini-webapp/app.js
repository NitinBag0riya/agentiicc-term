import { EthereumProvider } from 'https://esm.sh/@walletconnect/ethereum-provider@2.13.0';
import { ethers } from 'https://esm.sh/ethers@6.13.0';

// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// WalletConnect Project ID - Get yours at https://cloud.walletconnect.com
const WALLETCONNECT_PROJECT_ID = '1e765d59b7614cdacbc6d5a2b6508f93';

// UI Elements
const connectSection = document.getElementById('connect-section');
const loadingSection = document.getElementById('loading-section');
const successSection = document.getElementById('success-section');
const errorSection = document.getElementById('error-section');
const statusDiv = document.getElementById('status');
const loadingText = document.getElementById('loading-text');
const errorMessage = document.getElementById('error-message');
const walletAddressEl = document.getElementById('wallet-address');

// Buttons
const connectBtn = document.getElementById('connect-btn');
const retryBtn = document.getElementById('retry-btn');

// State
let provider = null;

// Show/hide sections
function showSection(section) {
  [connectSection, loadingSection, successSection, errorSection].forEach(s => {
    s.classList.add('hidden');
  });
  section.classList.remove('hidden');
}

function updateStatus(message) {
  statusDiv.textContent = message;
}

function updateLoadingText(text) {
  loadingText.textContent = text;
}

function showError(message) {
  errorMessage.textContent = message;
  showSection(errorSection);
}

// Helper function to add timeout to promises
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

// Detect Telegram environment
function isTelegramEnvironment() {
  try {
    if (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) {
      return true;
    }
    if ("TelegramWebviewProxy" in window &&
        typeof window.TelegramWebviewProxy.postEvent === "function") {
      window.TelegramGameProxy = { receiveEvent() {} };
      return true;
    }
    return false;
  } catch (error) {
    console.error("[TG] Error detecting Telegram environment:", error);
    return false;
  }
}

// Override window.open to use Telegram's openLink
function setupTelegramDeepLinks() {
  if (!isTelegramEnvironment()) {
    console.log('[TG] Not in Telegram environment, skipping openLink override');
    return;
  }

  console.log('[TG] Setting up deep link handler for Telegram Mini App');

  // Store original window.open
  const originalWindowOpen = window.open;

  // Override window.open to use Telegram's openLink
  window.open = function(url, target, features) {
    console.log('[TG] Intercepted window.open:', url);

    try {
      if (!url) return null;

      // Convert to string if needed
      if (typeof url !== "string") {
        url = url.toString();
      }

      // Handle metamask:// deep links
      if (url.startsWith("metamask://")) {
        url = url.replace("metamask://", "https://metamask.app.link/");
        console.log('[TG] Converted MetaMask deep link:', url);
      }

      // Handle trust:// deep links
      if (url.startsWith("trust://")) {
        url = url.replace("trust://", "https://link.trustwallet.com/");
        console.log('[TG] Converted Trust Wallet deep link:', url);
      }

      // Use Telegram's openLink for external URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        console.log('[TG] Opening link via Telegram.WebApp.openLink:', url);
        tg.openLink(url, { try_instant_view: false });
        return null;
      }

      // Fallback to original window.open for other cases
      return originalWindowOpen.call(window, url, target, features);

    } catch (error) {
      console.error('[TG] Error opening link:', error);
      // Fallback
      return originalWindowOpen.call(window, url, target, features);
    }
  };

  console.log('[TG] Deep link handler setup complete');
}

// Initialize deep link handling
setupTelegramDeepLinks();

// Handle Deep Link Params for Auto-Selection
function handleStartParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = tg.initDataUnsafe?.start_param || urlParams.get('start_param') || urlParams.get('startapp');
    console.log('[TG] Start Param:', startParam);
    
    if (startParam === 'link_hyperliquid') {
        const rad = document.querySelector('input[name="exchange"][value="hyperliquid"]');
        if (rad) rad.checked = true;
    } else if (startParam === 'link_aster') {
         const rad = document.querySelector('input[name="exchange"][value="aster"]');
        if (rad) rad.checked = true;       
    }
}
handleStartParams();

// Connect wallet and create API key
async function connectWalletAndCreateApiKey() {
  try {
    showSection(loadingSection);
    updateLoadingText('Initializing...');

    console.log('[Wallet] Starting WalletConnect v2 connection...');
    console.log('[Wallet] Environment: Telegram Mini App');

    // Check if project ID is set
    if (WALLETCONNECT_PROJECT_ID === 'YOUR_PROJECT_ID_HERE') {
      throw new Error('WalletConnect Project ID not configured. Please update app.js with a valid project ID from cloud.walletconnect.com');
    }

    updateLoadingText('Connecting to wallet...');

    // Detect device type
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('[Wallet] Device type:', isMobile ? 'Mobile' : 'Desktop');

    // Initialize WalletConnect provider
    provider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [1], // Ethereum mainnet
      optionalChains: [56, 137], // BSC, Polygon
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'light',
        themeVariables: {
          '--w3m-z-index': '999999'
        },
        // Don't try to redirect on mobile within Telegram
        mobileWallets: [
          {
            id: 'metamask',
            name: 'MetaMask',
            links: {
              native: 'metamask://',
              universal: 'https://metamask.app.link'
            }
          },
          {
            id: 'trust',
            name: 'Trust Wallet',
            links: {
              native: 'trust://',
              universal: 'https://link.trustwallet.com'
            }
          }
        ]
      },
      methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4'],
      events: ['chainChanged', 'accountsChanged'],
      metadata: {
        name: 'Aster DEX',
        description: 'Aster DEX Trading Bot',
        url: window.location.origin,
        icons: ['https://aster-dex.com/icon.png']
      }
    });

    console.log('[Wallet] Provider initialized');

    // Set up event listeners
    provider.on('display_uri', (uri) => {
      console.log('[WalletConnect] Display URI:', uri);
      console.log('[WalletConnect] QR Modal should be showing');
    });

    provider.on('connect', (info) => {
      console.log('[WalletConnect] Connected:', info);
    });

    provider.on('disconnect', (error) => {
      console.log('[WalletConnect] Disconnected:', error);
    });

    provider.on('accountsChanged', (accounts) => {
      console.log('[WalletConnect] Accounts changed:', accounts);
    });

    provider.on('chainChanged', (chainId) => {
      console.log('[WalletConnect] Chain changed:', chainId);
    });

    // Enable provider (shows QR modal)
    console.log('[Wallet] Enabling provider (this will show QR code or open wallet)...');

    updateLoadingText('Please scan QR code or open your wallet app...');

    const accounts = await withTimeout(
      provider.enable(),
      120000, // 2 minute timeout
      'Wallet connection timed out. Please try again.'
    );

    console.log('[Wallet] Provider enabled, accounts:', accounts);

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    // Create ethers provider (using v6 BrowserProvider)
    const web3Provider = new ethers.BrowserProvider(provider);
    const signer = await web3Provider.getSigner();
    const walletAddress = await signer.getAddress();

    console.log('[Wallet] Got wallet address:', walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4));
    updateLoadingText('Wallet connected: ' + walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4));

    // Small delay to show success message
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get Selected Exchange
    const exchange = document.querySelector('input[name="exchange"]:checked')?.value || 'aster';
    console.log('[App] Selected Exchange:', exchange);

    let nonce;
    let message;

    if (exchange === 'aster') {
        // Get nonce from Aster API
        updateLoadingText('Getting authentication nonce...');
        console.log('[API] Fetching nonce from Aster...');

        const nonceResponse = await fetch('/tgma/get-nonce', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress
          })
        });

        if (!nonceResponse.ok) {
          const errorData = await nonceResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to get nonce: ${nonceResponse.status}`);
        }

        const data = await nonceResponse.json();
        nonce = data.nonce;
        console.log('[API] Got nonce from Aster:', nonce);
        message = `You are signing into Astherus ${nonce}`;
    } else {
        // Hyperliquid
        nonce = Date.now().toString();
        message = `Link Hyperliquid Account ${nonce}`;
        console.log('[App] Generated nonce for Hyperliquid:', nonce);
    }
    
    // Create signature
    updateLoadingText('Please sign the message in your wallet...');
    console.log('[Wallet] Requesting signature...');

    const signature = await withTimeout(
      signer.signMessage(message),
      120000, // 2 minute timeout for signing
      'Signature request timed out. Please check your wallet app.'
    );

    console.log('[Wallet] Signature received');
    updateLoadingText('Signature received');

    // Call Cloudflare Function to create API key
    updateLoadingText('Creating API keys...');
    console.log('[API] Calling create-api-key endpoint...');
    console.log('[API] Telegram initData:', tg.initData ? 'Present' : 'Missing');

    const response = await fetch('/tgma/create-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        signature,
        nonce,
        tgInitData: tg.initData, // Telegram auth data
        exchange, // Pass selected exchange
      })
    });

    console.log('[API] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[API] Error response:', errorData);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[API] Success:', result);

    // Success!
    walletAddressEl.textContent = walletAddress;
    showSection(successSection);

    // Disconnect provider
    if (provider) {
      await provider.disconnect();
      console.log('[Wallet] Disconnected');
    }

    // Close mini app after 2 seconds
    setTimeout(() => {
      console.log('[TG] Closing Mini App');
      tg.close();
    }, 2000);

  } catch (error) {
    console.error('[Error] Wallet connection failed:', error);
    console.error('[Error] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Disconnect provider on error
    if (provider) {
      try {
        await provider.disconnect();
      } catch (e) {
        console.error('[Error] Failed to disconnect provider:', e);
      }
    }

    // Show user-friendly error message
    let errorMsg = error.message || 'Unknown error occurred';

    // Add helpful hints based on error type
    if (errorMsg.includes('timeout')) {
      errorMsg += '\n\nTip: Make sure your wallet app is installed and you complete the connection/signing within the time limit.';
    } else if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected') || errorMsg.includes('rejected')) {
      errorMsg = 'You cancelled the wallet connection. Please try again and approve the request in your wallet.';
    } else if (errorMsg.includes('Project ID')) {
      errorMsg = 'Configuration error. Please contact support.';
    } else if (errorMsg.includes('No accounts')) {
      errorMsg = 'No wallet accounts found. Please make sure your wallet is set up correctly.';
    }

    showError(errorMsg);
  }
}

// Event listeners
connectBtn.addEventListener('click', connectWalletAndCreateApiKey);
retryBtn.addEventListener('click', () => {
  // Clean up previous provider
  if (provider) {
    provider.disconnect().catch(console.error);
    provider = null;
  }
  showSection(connectSection);
  statusDiv.textContent = '';
});

// Handle Telegram theme
tg.setHeaderColor(tg.themeParams.bg_color || '#ffffff');
tg.setBackgroundColor(tg.themeParams.bg_color || '#ffffff');

// Log init data for debugging (remove in production)
console.log('[TG] Telegram initData:', tg.initData ? 'Present (length: ' + tg.initData.length + ')' : 'Missing');
console.log('[TG] Telegram user:', tg.initDataUnsafe?.user);
console.log('[WC] Using WalletConnect v2 with proper Telegram deep link handling');
console.log('[WC] Project ID configured:', WALLETCONNECT_PROJECT_ID !== 'YOUR_PROJECT_ID_HERE');
