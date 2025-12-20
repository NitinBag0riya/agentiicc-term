import { EthereumProvider } from 'https://esm.sh/@walletconnect/ethereum-provider@2.13.0';
import { ethers } from 'https://esm.sh/ethers@6.13.0';

// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Configuration
const WALLETCONNECT_PROJECT_ID = '1e765d59b7614cdacbc6d5a2b6508f93';
const DEFAULT_EXCHANGE = 'aster';
const API_URL = ''; // Leave empty for relative calls if served from same origin, or set full URL

// Get exchange from URL params or default
const urlParams = new URLSearchParams(window.location.search);
const activeExchange = urlParams.get('exchange') || DEFAULT_EXCHANGE;
const exchangeName = activeExchange.charAt(0).toUpperCase() + activeExchange.slice(1);

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

// Dynamic UI Text Update
document.querySelectorAll('.exchange-placeholder').forEach(el => {
  el.textContent = exchangeName;
});

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

// Helper function to add timeout
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
  return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
}

// Override window.open for Telegram
function setupTelegramDeepLinks() {
  if (!isTelegramEnvironment()) return;

  const originalWindowOpen = window.open;
  window.open = function(url, target, features) {
    try {
      if (!url) return null;
      let targetUrl = url.toString();

      if (targetUrl.startsWith("metamask://")) {
        targetUrl = targetUrl.replace("metamask://", "https://metamask.app.link/");
      } else if (targetUrl.startsWith("trust://")) {
        targetUrl = targetUrl.replace("trust://", "https://link.trustwallet.com/");
      }

      if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
        tg.openLink(targetUrl, { try_instant_view: false });
        return null;
      }
      return originalWindowOpen.call(window, targetUrl, target, features);
    } catch (error) {
      console.error('[TG] Link error:', error);
      return originalWindowOpen.call(window, url, target, features);
    }
  };
}

setupTelegramDeepLinks();

// Connect wallet and link account
async function connectWalletAndLinkAccount() {
  try {
    showSection(loadingSection);
    updateLoadingText('Initializing...');

    provider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [1],
      optionalChains: [56, 137],
      showQrModal: true,
      qrModalOptions: {
        themeMode: tg.colorScheme || 'light',
        themeVariables: { '--w3m-z-index': '999999' }
      },
      metadata: {
        name: 'AgentFi',
        description: 'Agentic Trading Platform',
        url: window.location.origin,
        icons: [window.location.origin + '/icon.png']
      }
    });

    updateLoadingText('Connecting to wallet...');
    const accounts = await withTimeout(provider.enable(), 120000, 'Connection timed out');

    const web3Provider = new ethers.BrowserProvider(provider);
    const signer = await web3Provider.getSigner();
    const walletAddress = await signer.getAddress();

    updateLoadingText('Wallet connected. Getting nonce...');

    // 1. Get nonce from Universal API
    const nonceResponse = await fetch(`${API_URL}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange: activeExchange, address: walletAddress })
    });

    if (!nonceResponse.ok) {
      const errorData = await nonceResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get nonce');
    }

    const { nonce } = await nonceResponse.json();

    // 2. Sign message
    updateLoadingText('Please sign the authentication message...');
    const message = activeExchange === 'aster' 
      ? `You are signing into Astherus ${nonce}`
      : `Sign into AgentFi for ${activeExchange}: ${nonce}`;

    const signature = await withTimeout(signer.signMessage(message), 120000, 'Signing timed out');

    // 3. Link account via Universal API
    updateLoadingText('Verifying and linking account...');
    const linkResponse = await fetch(`${API_URL}/auth/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tgInitData: tg.initData,
        exchange: activeExchange,
        walletAddress,
        signature,
        nonce
      })
    });

    if (!linkResponse.ok) {
      const errorData = await linkResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Link failed');
    }

    // Success
    walletAddressEl.textContent = walletAddress;
    showSection(successSection);

    if (provider) await provider.disconnect();
    setTimeout(() => tg.close(), 2500);

  } catch (error) {
    console.error('[Error]', error);
    if (provider) provider.disconnect().catch(() => {});
    showError(error.message || 'Unknown error occurred');
  }
}

connectBtn.addEventListener('click', connectWalletAndLinkAccount);
retryBtn.addEventListener('click', () => {
  if (provider) provider.disconnect().catch(() => {});
  provider = null;
  showSection(connectSection);
});

// Theme sync
tg.setHeaderColor(tg.themeParams.bg_color || '#ffffff');
tg.setBackgroundColor(tg.themeParams.bg_color || '#ffffff');
