  const screens = {
    welcome: {
      category: 'Authentication',
      name: 'Welcome Screen',
      description: 'First screen users see when starting the bot',
      telegram_ui: `┌─────────────────────────────┐
│  👋 Welcome to StableSolid  │
│                             │
│ Your Easy Terminal into     │
│ Multi-Exchange Trading      │
│                             │
│ Choose Exchange to Connect: │
│                             │
│ 🔸 Aster DEX                │
│   Advanced trading features │
│   Spot & perpetual swaps    │
│                             │
│ 🔸 Hyperliquid              │
│   High-leverage trading     │
│   BTC/ETH focused           │
│                             │
│ 💡 Connect at least one     │
│    exchange to get started  │
│ 💡 You can add more later   │
└─────────────────────────────┘

[🔸 Aster DEX] [🔸 Hyperliquid]
[❓ Help]`,
      navigation: [
        { action: 'Click Aster DEX', to: 'exchange_selection_aster' },
        { action: 'Click Hyperliquid', to: 'exchange_selection_hyperliquid' },
        { action: 'Click Help', to: 'help' },
      ],
      data_flow: {
        reads: ['telegram_user_id'],
        writes: ['session_start'],
        validates: ['not_authenticated'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/user',
          description: 'Create user account (for WalletConnect flow)',
          body: {
            telegramId: 123456,
            username: 'trader_demo'
          },
          _note: 'Called automatically when user first connects'
        }
      ],
    },
    link_wizard_step1: {
      category: 'Authentication',
      name: 'API Setup - Step 1',
      description: 'User enters wallet address',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Link Your AsterDEX       │
│    Account                  │
│                             │
│ Step 1 of 2                 │
│                             │
│ Please enter your           │
│ Wallet Address:             │
│                             │
│ Example:                    │
│ 0x742d35Cc6634C0532925a3b  │
│ 844Bc9e7595f0bEb            │
│                             │
│ ✅ Your wallet address      │
│    will be encrypted        │
│                             │
│ 🔒 We never share your      │
│    credentials              │
└─────────────────────────────┘

[❌ Cancel]`,
      navigation: [
        { action: 'User types wallet address', to: 'link_wizard_step2' },
        { action: 'Click Cancel', to: 'welcome' },
      ],
      data_flow: {
        reads: ['user_input'],
        writes: ['wallet_address_temp'],
        validates: ['ethereum_address_format'],
      },
      api_endpoints: [      ],
    },
    mini_app_auth_aster: {
      category: 'Authentication',
      name: 'Aster DEX Wallet Connect',
      description: 'Connect wallet to Aster DEX',
      telegram_ui: `┌─────────────────────────────┐
│ 🔐 Connect to Aster DEX    │
│                             │
│ Connecting your wallet to   │
│ Aster DEX...                │
│                             │
│ 📱 Please approve the       │
│    connection in your       │
│    wallet app               │
│                             │
│ 🔗 Required Permissions:    │
│ • View account balance      │
│ • Place trades              │
│ • View positions            │
│                             │
│ ⏳ Waiting for approval...  │
└─────────────────────────────┘

[🔄 Refresh Status]
[❌ Cancel]`,
      navigation: [
        { action: 'Wallet Connected', to: 'validating_aster' },
        { action: 'Click Refresh Status', to: 'mini_app_auth_aster' },
        { action: 'Click Cancel', to: 'exchange_selection_aster' },
        { action: 'Connection Failed', to: 'auth_error_aster' },
      ],
      data_flow: {
        reads: ['wallet_connection'],
        writes: ['auth_token_aster', 'account_verified_aster'],
        validates: ['wallet_signature_valid'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/auth/wallet/aster',
          description: 'Authenticate with Aster DEX via wallet',
          body: {
            walletAddress: '{{walletAddress}}',
            signature: '{{signature}}',
            message: '{{authMessage}}'
          }
        }
      ],
    },
    link_wizard_aster: {
      category: 'Authentication',
      name: 'Aster DEX API Setup',
      description: 'Setup API credentials for Aster DEX',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Aster DEX API Setup     │
│                             │
│ Step 1: Enter your wallet   │
│ address from Aster DEX      │
│                             │
│ 📝 Format: 0x...           │
│                             │
│ 💡 Find this in:           │
│ Settings > API Keys >       │
│ Wallet Address              │
│                             │
│ 🔒 This will be encrypted   │
│    and stored securely      │
└─────────────────────────────┘

[Type wallet address]
[🔙 Back] [❌ Cancel]`,
      navigation: [
        { action: 'User enters wallet address', to: 'link_wizard_aster_step2' },
        { action: 'Click Back', to: 'exchange_selection_aster' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['user_input'],
        writes: ['wallet_address_aster'],
        validates: ['ethereum_address_format'],
      },
      api_endpoints: [],
    },
    link_wizard_aster_step2: {
      category: 'Authentication',
      name: 'Aster DEX API Key',
      description: 'Enter API key for Aster DEX',
      telegram_ui: `┌─────────────────────────────┐
│ 🔑 Aster DEX API Key       │
│                             │
│ Step 2: Enter your API Key  │
│                             │
│ 📝 This is sensitive data   │
│     handle with care        │
│                             │
│ 💡 Find this in:           │
│ Settings > API Keys >       │
│ Create New Key              │
│                             │
│ Required permissions:       │
│ • Read account info         │
│ • Place orders              │
│ • Read positions            │
└─────────────────────────────┘

[Type API key]
[🔙 Back] [❌ Cancel]`,
      navigation: [
        { action: 'User enters API key', to: 'validating_aster' },
        { action: 'Click Back', to: 'link_wizard_aster' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['user_input', 'wallet_address_aster'],
        writes: ['api_key_aster'],
        validates: ['api_key_format'],
      },
      api_endpoints: [],
    },
    validating_aster: {
      category: 'Authentication',
      name: 'Validating Aster Connection',
      description: 'Testing Aster DEX credentials',
      telegram_ui: `┌─────────────────────────────┐
│ ⏳ Validating Aster DEX     │
│    Connection               │
│                             │
│ Testing API credentials...  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Connecting to Aster DEX...  │
│ Fetching account data...    │
│                             │
│ This may take a few         │
│ seconds.                    │
└─────────────────────────────┘`,
      navigation: [
        { action: 'Success', to: 'universal_citadel' },
        { action: 'Failure', to: 'auth_error_aster' },
      ],
      data_flow: {
        reads: ['api_key_aster', 'wallet_address_aster'],
        writes: ['auth_token_aster', 'account_verified_aster'],
        validates: ['api_connection', 'account_balance'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/auth/credentials/aster',
          description: 'Validate Aster DEX credentials',
          body: {
            walletAddress: '{{wallet_address_aster}}',
            apiKey: '{{api_key_aster}}'
          }
        },
        {
          method: 'GET',
          path: '/account?exchange=aster',
          description: 'Verify Aster DEX account connection',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        }
      ],
    },
    auth_error_aster: {
      category: 'Authentication',
      name: 'Aster Connection Failed',
      description: 'Error connecting to Aster DEX',
      telegram_ui: `┌─────────────────────────────┐
│ ❌ Connection Failed        │
│                             │
│ Failed to connect to        │
│ Aster DEX.                  │
│                             │
│ Possible issues:            │
│ • Invalid API credentials   │
│ • Network connection        │
│ • Exchange maintenance      │
│                             │
│ Please check your API key   │
│ and try again.              │
│                             │
│ 💡 Need help? Contact       │
│    support@stablesolid.com  │
└─────────────────────────────┘

[🔄 Try Again]
[⚙️ Change Settings]
[❌ Cancel]`,
      navigation: [
        { action: 'Click Try Again', to: 'link_wizard_aster' },
        { action: 'Click Change Settings', to: 'exchange_selection_aster' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['connection_error'],
        writes: ['error_logged'],
        validates: [],
      },
      api_endpoints: [],
    },
    mini_app_auth_hyperliquid: {
      category: 'Authentication',
      name: 'Hyperliquid Wallet Connect',
      description: 'Connect wallet to Hyperliquid',
      telegram_ui: `┌─────────────────────────────┐
│ 🔐 Connect to Hyperliquid  │
│                             │
│ Connecting your wallet to   │
│ Hyperliquid...              │
│                             │
│ 📱 Please approve the       │
│    connection in your       │
│    wallet app               │
│                             │
│ 🔗 Required Permissions:    │
│ • View account balance      │
│ • Place trades              │
│ • View positions            │
│                             │
│ ⏳ Waiting for approval...  │
└─────────────────────────────┘

[🔄 Refresh Status]
[❌ Cancel]`,
      navigation: [
        { action: 'Wallet Connected', to: 'validating_hyperliquid' },
        { action: 'Click Refresh Status', to: 'mini_app_auth_hyperliquid' },
        { action: 'Click Cancel', to: 'exchange_selection_hyperliquid' },
        { action: 'Connection Failed', to: 'auth_error_hyperliquid' },
      ],
      data_flow: {
        reads: ['wallet_connection'],
        writes: ['auth_token_hyperliquid', 'account_verified_hyperliquid'],
        validates: ['wallet_signature_valid'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/auth/wallet/hyperliquid',
          description: 'Authenticate with Hyperliquid via wallet',
          body: {
            walletAddress: '{{walletAddress}}',
            signature: '{{signature}}',
            message: '{{authMessage}}'
          }
        }
      ],
    },
    link_wizard_hyperliquid: {
      category: 'Authentication',
      name: 'Hyperliquid API Setup',
      description: 'Setup API credentials for Hyperliquid',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Hyperliquid API Setup   │
│                             │
│ Step 1: Enter your wallet   │
│ address from Hyperliquid    │
│                             │
│ 📝 Format: 0x...           │
│                             │
│ 💡 Find this in:           │
│ Settings > API Keys >       │
│ Wallet Address              │
│                             │
│ 🔒 This will be encrypted   │
│    and stored securely      │
└─────────────────────────────┘

[Type wallet address]
[🔙 Back] [❌ Cancel]`,
      navigation: [
        { action: 'User enters wallet address', to: 'link_wizard_hyperliquid_step2' },
        { action: 'Click Back', to: 'exchange_selection_hyperliquid' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['user_input'],
        writes: ['wallet_address_hyperliquid'],
        validates: ['ethereum_address_format'],
      },
      api_endpoints: [],
    },
    link_wizard_hyperliquid_step2: {
      category: 'Authentication',
      name: 'Hyperliquid API Key',
      description: 'Enter API key for Hyperliquid',
      telegram_ui: `┌─────────────────────────────┐
│ 🔑 Hyperliquid API Key     │
│                             │
│ Step 2: Enter your API Key  │
│                             │
│ 📝 This is sensitive data   │
│     handle with care        │
│                             │
│ 💡 Find this in:           │
│ Settings > API Keys >       │
│ Create New Key              │
│                             │
│ Required permissions:       │
│ • Read account info         │
│ • Place orders              │
│ • Read positions            │
└─────────────────────────────┘

[Type API key]
[🔙 Back] [❌ Cancel]`,
      navigation: [
        { action: 'User enters API key', to: 'validating_hyperliquid' },
        { action: 'Click Back', to: 'link_wizard_hyperliquid' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['user_input', 'wallet_address_hyperliquid'],
        writes: ['api_key_hyperliquid'],
        validates: ['api_key_format'],
      },
      api_endpoints: [],
    },
    validating_hyperliquid: {
      category: 'Authentication',
      name: 'Validating Hyperliquid Connection',
      description: 'Testing Hyperliquid credentials',
      telegram_ui: `┌─────────────────────────────┐
│ ⏳ Validating Hyperliquid   │
│    Connection               │
│                             │
│ Testing API credentials...  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Connecting to Hyperliquid...│
│ Fetching account data...    │
│                             │
│ This may take a few         │
│ seconds.                    │
└─────────────────────────────┘`,
      navigation: [
        { action: 'Success', to: 'universal_citadel' },
        { action: 'Failure', to: 'auth_error_hyperliquid' },
      ],
      data_flow: {
        reads: ['api_key_hyperliquid', 'wallet_address_hyperliquid'],
        writes: ['auth_token_hyperliquid', 'account_verified_hyperliquid'],
        validates: ['api_connection', 'account_balance'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/auth/credentials/hyperliquid',
          description: 'Validate Hyperliquid credentials',
          body: {
            walletAddress: '{{wallet_address_hyperliquid}}',
            apiKey: '{{api_key_hyperliquid}}'
          }
        },
        {
          method: 'GET',
          path: '/account?exchange=hyperliquid',
          description: 'Verify Hyperliquid account connection',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        }
      ],
    },
    auth_error_hyperliquid: {
      category: 'Authentication',
      name: 'Hyperliquid Connection Failed',
      description: 'Error connecting to Hyperliquid',
      telegram_ui: `┌─────────────────────────────┐
│ ❌ Connection Failed        │
│                             │
│ Failed to connect to        │
│ Hyperliquid.                │
│                             │
│ Possible issues:            │
│ • Invalid API credentials   │
│ • Network connection        │
│ • Exchange maintenance      │
│                             │
│ Please check your API key   │
│ and try again.              │
│                             │
│ 💡 Need help? Contact       │
│    support@stablesolid.com  │
└─────────────────────────────┘

[🔄 Try Again]
[⚙️ Change Settings]
[❌ Cancel]`,
      navigation: [
        { action: 'Click Try Again', to: 'link_wizard_hyperliquid' },
        { action: 'Click Change Settings', to: 'exchange_selection_hyperliquid' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['connection_error'],
        writes: ['error_logged'],
        validates: [],
      },
      api_endpoints: [],
    },
    link_wizard_step2: {
      category: 'Authentication',
      name: 'API Setup - Step 2',
      description: 'User enters private key',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Link Your AsterDEX       │
│    Account                  │
│                             │
│ Step 2 of 2                 │
│                             │
│ Wallet: 0x742d...0bEb ✅    │
│                             │
│ Now enter your              │
│ Private Key:                │
│                             │
│ ⚠️  Security Notice:        │
│ • Your key is encrypted     │
│   with AES-256              │
│ • Stored securely in our    │
│   database                  │
│ • Never transmitted in      │
│   plain text                │
│ • Only used for authorized  │
│   trades                    │
└─────────────────────────────┘

[🔙 Back] [❌ Cancel]`,
      navigation: [
        { action: 'User types private key', to: 'validating' },
        { action: 'Click Back', to: 'link_wizard_step1' },
        { action: 'Click Cancel', to: 'welcome' },
      ],
      data_flow: {
        reads: ['user_input', 'wallet_address_temp'],
        writes: ['encrypted_private_key'],
        validates: ['private_key_format'],
      },
      api_endpoints: [],
    },
    validating: {
      category: 'Authentication',
      name: 'Validating Connection',
      description: 'Testing API credentials',
      telegram_ui: `┌─────────────────────────────┐
│ ⏳ Validating Your          │
│    Connection               │
│                             │
│ Testing API credentials...  │
│ ▓▓▓▓▓▓░░░░░░░░░░░░░        │
│                             │
│ Connecting to AsterDEX...   │
│ Fetching account data...    │
│                             │
│ This may take a few         │
│ seconds.                    │
└─────────────────────────────┘`,
      navigation: [
        { action: 'Success', to: 'universal_citadel' },
        { action: 'Failure', to: 'api_error' },
      ],
      data_flow: {
        reads: ['encrypted_credentials'],
        writes: ['auth_token', 'account_verified'],
        validates: ['api_connection', 'account_balance'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/user/credentials',
          description: 'Link exchange credentials',
          body: {
            userId: '{{userId}}',
            exchange: 'aster | hyperliquid',
            apiKey: 'YOUR_API_KEY',
            apiSecret: 'YOUR_API_SECRET',
            _note: 'For Hyperliquid: use address and privateKey instead'
          }
        },
        {
          method: 'POST',
          path: '/auth/session',
          description: 'Create unified session',
          body: {
            userId: '{{userId}}'
          }
        },
        {
          method: 'GET',
          path: '/account?exchange={{exchangeId}}',
          description: 'Verify account connection',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        }
      ],
    },
    universal_citadel: {
      category: 'Overview',
      name: 'Universal Command Citadel',
      description: 'Multi-exchange overview dashboard',
      telegram_ui: `┌─────────────────────────────┐
│ 🌍 Universal Command Citadel │
│                             │
│ Connected Exchanges:        │
│                             │
│ ✅ Aster DEX                │
│ ❌ Hyperliquid              │
│   (Not Connected)           │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 📊 Portfolio Overview:      │
│                             │
│ 🔸 Aster DEX:               │
│ Balance: $8,691.28          │
│ uPnL: +$123.45 (+2.36%)     │
│ 3 Positions                 │
│                             │
│ 🔸 Hyperliquid:             │
│ Not Connected - Click to    │
│ link this exchange          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💬 Click connected exchange │
│    for full dashboard       │
│ 💬 Click unlinked exchange  │
│    to connect it            │
│ 💡 Dynamic: Shows different │
│    content based on which   │
│    exchanges are linked     │
└─────────────────────────────┘

[✅ Aster DEX] [❌ Connect Hyperliquid]
[📊 All Assets] [💰 Trade]
[⚙️ Settings] [❓ Help]`,
      navigation: [
        { action: 'Click Aster DEX', to: 'citadel_aster' },
        { action: 'Click Hyperliquid', to: 'citadel_hyperliquid' },
        { action: 'Click Connect Hyperliquid', to: 'confirm_connect_hyperliquid' },
        { action: 'Click Connect Aster DEX', to: 'confirm_connect_aster' },
        { action: 'Click All Assets', to: 'all_assets_universal' },
        { action: 'Click Trade', to: 'search_prompt_universal' },
        { action: 'Click Settings', to: 'settings_universal' },
        { action: 'Click Help', to: 'help' },
      ],
      data_flow: {
        reads: ['all_exchanges_data', 'linked_exchanges'],
        writes: ['universal_display_cache'],
        validates: ['at_least_one_exchange_linked'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/user/exchanges?userId={{userId}}',
          description: 'Get all linked exchanges',
          _note: 'No auth required for this endpoint'
        },
        {
          method: 'GET',
          path: '/account?exchange={{exchangeId}}',
          description: 'Get account data for each linked exchange',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Call once for each linked exchange (aster, hyperliquid)',
          response: {
            success: true,
            data: {
              totalBalance: 8691.28,
              availableBalance: 4234.50,
              perpBalance: 5234.50,
              spotBalance: 3456.78
            }
          }
        },
        {
          method: 'GET',
          path: '/positions?exchange={{exchangeId}}',
          description: 'Get positions for each linked exchange',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Call once for each linked exchange to count positions'
        }
      ],
    },
    citadel_aster: {
      category: 'Overview',
      name: 'Aster Command Citadel',
      description: 'Aster DEX dashboard with portfolio overview',
      telegram_ui: `┌─────────────────────────────┐
│ 🏰 Command Citadel          │
│                             │
│ 📊 Perp Portfolio:          │
│ balance $5,234.50           │
│ uPnL: +$123.45 (+2.36%)     │
│ Margin Used: $1,000.00      │
│                             │
│ ASTERUSDT (10x Cross) 🔈    │
│ +15.23% (+$152.30)          │
│ 1234 ASTER/$5000            │
│ Margin $500.00              │
│ Entry $4.05000              │
│ Mark $4.66690               │
│ Liq $3.85000                │
│                             │
│ ETHUSDT (5x Isolated) 🔉    │
│ +2.45% (+$12.25)            │
│ ...and 5 more               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💼 Spot Portfolio:          │
│ Balance: $3,456.78          │
│                             │
│ ASTERUSDT +12.50% (+$45.67) │
│ 10000.00000000 ASTER        │
│                             │
│ ETHUSDT -3.25% (-$23.45)    │
│ 1.50000000 ETH              │
│ ...and 3 more               │
│                             │
│ Spot available $500.50 USDT │
│ Perp available $4,234.50    │
│                             │
│ Account Balance: $8,691.28  │
│                             │
│ 💬 Click any position/asset │
│    to manage                │
│ 💬 Type symbol to search    │
│    (e.g., SOL)              │
└─────────────────────────────┘

[📊 All Assets] [📈 All Perps]
[💰 Trade] [🔄 Refresh]
[⚙️ Settings] [❓ Help]`,
      navigation: [
        { action: 'Click position (e.g., ASTERUSDT)', to: 'position_with_open' },
        { action: 'Click All Perps', to: 'all_perps' },
        { action: 'Click All Assets', to: 'all_assets' },
        { action: 'Click Trade', to: 'search_prompt' },
        { action: 'Type symbol (e.g., "SOL")', to: 'search_results' },
        { action: 'Click Settings', to: 'settings' },
        { action: 'Click Help', to: 'help' },
        { action: 'Click Refresh', to: 'citadel_aster' },
        { action: 'Click Back to Universal', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['account_balance', 'perp_positions', 'spot_assets', 'market_prices'],
        writes: ['display_cache'],
        validates: ['account_active'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/account?exchange=aster',
          description: 'Get Aster account balance and summary',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: {
              totalBalance: 8691.28,
              availableBalance: 4234.50,
              marginUsed: 1000.00,
              perpBalance: 5234.50,
              spotBalance: 3456.78,
              perpAvailable: 4234.50,
              spotAvailable: 500.50
            }
          },
          _note: 'UI displays: balance, uPnL, margin used, spot/perp balances',
          ui_transformations: [
            {
              api_field: 'data.totalBalance',
              ui_display: 'Account Balance: $8,691.28',
              calculation: '`Account Balance: $${totalBalance.toFixed(2)}`'
            },
            {
              api_field: 'data.perpBalance',
              ui_display: 'balance $5,234.50',
              calculation: '`balance $${perpBalance.toFixed(2)}`'
            },
            {
              api_field: 'data.marginUsed',
              ui_display: 'Margin Used: $1,000.00',
              calculation: '`Margin Used: $${marginUsed.toFixed(2)}`'
            },
            {
              api_field: 'data.spotBalance',
              ui_display: 'Balance: $3,456.78',
              calculation: '`Balance: $${spotBalance.toFixed(2)}`'
            }
          ]
        },
        {
          method: 'GET',
          path: '/positions?exchange=aster',
          description: 'Get all Aster positions',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                symbol: 'ASTERUSDT',
                positionAmt: '1234.00000000',
                entryPrice: '4.05000',
                markPrice: '4.66690',
                unRealizedProfit: '152.30',
                leverage: '10',
                marginType: 'CROSS',
                notional: '5000.00',
                liquidationPrice: '3.85000',
                margin: '500.00'
              }
            ]
          },
          _note: 'UI calculates: PnL% = (unRealizedProfit/margin)*100, Side = positionAmt > 0 ? LONG : SHORT',
          ui_transformations: [
            {
              api_field: 'positionAmt',
              ui_display: '1234 ASTER/$5000',
              calculation: '`${Math.abs(parseFloat(positionAmt))} ${baseAsset}/$${notional}`',
              _note: 'baseAsset = symbol.replace(/USDT$|USDC$|USD$/, "")'
            },
            {
              api_field: 'positionAmt',
              ui_display: 'LONG 🟢 or SHORT 🔴',
              calculation: '`${parseFloat(positionAmt) > 0 ? "LONG 🟢" : "SHORT 🔴"}`'
            },
            {
              api_field: 'unRealizedProfit, margin',
              ui_display: '+15.23% (+$152.30)',
              calculation: '`${(parseFloat(unRealizedProfit) / parseFloat(margin) * 100).toFixed(2)}% (${unRealizedProfit >= 0 ? "+" : ""}$${unRealizedProfit})`',
              formula: 'PnL% = (unRealizedProfit / margin) * 100'
            },
            {
              api_field: 'leverage, marginType',
              ui_display: '(10x Cross)',
              calculation: '`(${leverage}x ${marginType === "CROSS" ? "Cross" : "Isolated"})`'
            },
            {
              api_field: 'entryPrice',
              ui_display: 'Entry $4.05000',
              calculation: '`Entry $${parseFloat(entryPrice).toFixed(5)}`'
            },
            {
              api_field: 'markPrice',
              ui_display: 'Mark $4.66690',
              calculation: '`Mark $${parseFloat(markPrice).toFixed(5)}`'
            },
            {
              api_field: 'liquidationPrice',
              ui_display: 'Liq $3.85000',
              calculation: '`Liq $${parseFloat(liquidationPrice).toFixed(5)}`'
            },
            {
              api_field: 'margin',
              ui_display: 'Margin $500.00',
              calculation: '`Margin $${parseFloat(margin).toFixed(2)}`'
            }
          ]
        },
        {
          method: 'GET',
          path: '/ticker/{SYMBOL}?exchange=aster',
          description: 'Get 24h price stats for each position symbol',
          response: {
            success: true,
            data: {
              symbol: 'SOLUSDT',
              lastPrice: '142.50',
              openPrice: '135.18',
              priceChangePercent: '5.23',
              highPrice: '145.20',
              lowPrice: '138.10',
              quoteVolume: '45200000'
            }
          },
          _note: 'Call multiple times for each symbol. UI displays: Price, 24h Change, High/Low, Volume',
          ui_transformations: [
            {
              api_field: 'lastPrice',
              ui_display: 'Price: $142.50',
              calculation: '`Price: $${parseFloat(lastPrice).toFixed(2)}`'
            },
            {
              api_field: 'priceChangePercent, lastPrice, openPrice',
              ui_display: '24h Change: +5.23% (+$7.32)',
              calculation: '`24h Change: ${priceChangePercent >= 0 ? "+" : ""}${parseFloat(priceChangePercent).toFixed(2)}% (${(parseFloat(lastPrice) - parseFloat(openPrice)) >= 0 ? "+" : ""}$${(parseFloat(lastPrice) - parseFloat(openPrice)).toFixed(2)})`',
              formula: 'change$ = lastPrice - openPrice'
            },
            {
              api_field: 'highPrice, lowPrice',
              ui_display: '24h High/Low: $145.20 / $138.10',
              calculation: '`24h High/Low: $${parseFloat(highPrice).toFixed(2)} / $${parseFloat(lowPrice).toFixed(2)}`'
            },
            {
              api_field: 'quoteVolume',
              ui_display: '24h Volume: 45.2M USDT',
              calculation: '`24h Volume: ${(parseFloat(quoteVolume) / 1000000).toFixed(1)}M USDT`',
              formula: 'volumeDisplay = quoteVolume / 1,000,000'
            }
          ]
        }
      ],
    },
    citadel_hyperliquid: {
      category: 'Overview',
      name: 'Hyperliquid Command Citadel',
      description: 'Hyperliquid dashboard with portfolio overview',
      telegram_ui: `┌─────────────────────────────┐
│ 🏰 Hyperliquid Command      │
│    Citadel                  │
│                             │
│ 📊 Perp Portfolio:          │
│ balance $4,543.22           │
│ uPnL: +$333.33 (+7.33%)     │
│ Margin Used: $800.00        │
│                             │
│ BTC (25x Cross) 🔈          │
│ +12.45% (+$245.67)          │
│ 0.25 BTC/$10000             │
│ Margin $400.00              │
│ Entry $40000.00             │
│ Mark $43250.00              │
│ Liq $38000.00               │
│                             │
│ ETH (10x Isolated) 🔉       │
│ +8.22% (+$87.55)            │
│ 1.5 ETH/$3000               │
│ Margin $300.00              │
│ Entry $2000.00              │
│ Mark $2167.50               │
│ Liq $1850.00                │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ 💼 Spot Portfolio:          │
│ Balance: $2,000.00          │
│                             │
│ BTC +5.50% (+$275.00)       │
│ 0.05000000 BTC              │
│                             │
│ ETH -2.25% (-$45.00)        │
│ 0.50000000 ETH              │
│                             │
│ Spot available $1,500.00 USDC│
│ Perp available $3,743.22     │
│                             │
│ Account Balance: $6,543.22  │
│                             │
│ 💬 Click any position/asset │
│    to manage                │
│ 💬 Type symbol to search    │
│    (e.g., SOL)              │
└─────────────────────────────┘

[📊 All Assets] [📈 All Perps]
[💰 Trade] [🔄 Refresh]
[⚙️ Settings] [❓ Help]`,
      navigation: [
        { action: 'Click position (e.g., BTC)', to: 'position_with_open' },
        { action: 'Click All Perps', to: 'all_perps' },
        { action: 'Click All Assets', to: 'all_assets' },
        { action: 'Click Trade', to: 'search_prompt' },
        { action: 'Type symbol (e.g., "SOL")', to: 'search_results' },
        { action: 'Click Settings', to: 'settings' },
        { action: 'Click Refresh', to: 'citadel_hyperliquid' },
        { action: 'Click Back to Universal', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['account_balance', 'perp_positions', 'spot_assets', 'market_prices'],
        writes: ['display_cache'],
        validates: ['account_active'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/account?exchange=hyperliquid',
          description: 'Get Hyperliquid account balance and summary',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: {
              totalBalance: 6543.22,
              availableBalance: 3743.22,
              marginUsed: 800.00,
              perpBalance: 4543.22,
              spotBalance: 2000.00,
              perpAvailable: 3743.22,
              spotAvailable: 1500.00
            }
          },
          _note: 'UI displays: balance, uPnL, margin used, spot/perp balances',
          ui_transformations: [
            {
              api_field: 'data.totalBalance',
              ui_display: 'Account Balance: $6,543.22',
              calculation: '`Account Balance: $${totalBalance.toFixed(2)}`'
            },
            {
              api_field: 'data.perpBalance',
              ui_display: 'balance $4,543.22',
              calculation: '`balance $${perpBalance.toFixed(2)}`'
            },
            {
              api_field: 'data.marginUsed',
              ui_display: 'Margin Used: $800.00',
              calculation: '`Margin Used: $${marginUsed.toFixed(2)}`'
            },
            {
              api_field: 'data.spotBalance',
              ui_display: 'Balance: $2,000.00',
              calculation: '`Balance: $${spotBalance.toFixed(2)}`'
            }
          ]
        },
        {
          method: 'GET',
          path: '/positions?exchange=hyperliquid',
          description: 'Get all Hyperliquid positions',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                symbol: 'BTC',
                positionAmt: '0.25000000',
                entryPrice: '40000.00',
                markPrice: '43250.00',
                unRealizedProfit: '815.00',
                leverage: '25',
                marginType: 'CROSS',
                notional: '10000.00',
                liquidationPrice: '38000.00',
                margin: '400.00'
              }
            ]
          },
          _note: 'UI calculates: PnL% = (unRealizedProfit/margin)*100, Side = positionAmt > 0 ? LONG : SHORT',
          ui_transformations: [
            {
              api_field: 'positionAmt',
              ui_display: '0.25 BTC/$10000',
              calculation: '`${Math.abs(parseFloat(positionAmt))} ${baseAsset}/$${notional}`'
            },
            {
              api_field: 'positionAmt',
              ui_display: 'LONG 🟢',
              calculation: '`${parseFloat(positionAmt) > 0 ? "LONG 🟢" : "SHORT 🔴"}`'
            },
            {
              api_field: 'unRealizedProfit, margin',
              ui_display: '+12.45% (+$245.67)',
              calculation: '`${(parseFloat(unRealizedProfit) / parseFloat(margin) * 100).toFixed(2)}% (${unRealizedProfit >= 0 ? "+" : ""}$${unRealizedProfit})`',
              formula: 'PnL% = (unRealizedProfit / margin) * 100'
            },
            {
              api_field: 'leverage, marginType',
              ui_display: '(25x Cross)',
              calculation: '`(${leverage}x ${marginType === "CROSS" ? "Cross" : "Isolated"})`'
            },
            {
              api_field: 'entryPrice',
              ui_display: 'Entry $40000.00',
              calculation: '`Entry $${parseFloat(entryPrice).toFixed(2)}`'
            },
            {
              api_field: 'markPrice',
              ui_display: 'Mark $43250.00',
              calculation: '`Mark $${parseFloat(markPrice).toFixed(2)}`'
            },
            {
              api_field: 'liquidationPrice',
              ui_display: 'Liq $38000.00',
              calculation: '`Liq $${parseFloat(liquidationPrice).toFixed(2)}`'
            },
            {
              api_field: 'margin',
              ui_display: 'Margin $400.00',
              calculation: '`Margin $${parseFloat(margin).toFixed(2)}`'
            }
          ]
        },
        {
          method: 'GET',
          path: '/ticker/{SYMBOL}?exchange=hyperliquid',
          description: 'Get 24h price stats for each position symbol',
          response: {
            success: true,
            data: {
              symbol: 'BTC',
              lastPrice: '43250.00',
              openPrice: '42000.00',
              priceChangePercent: '3.01',
              highPrice: '44500.00',
              lowPrice: '41500.00',
              quoteVolume: '125000000'
            }
          },
          _note: 'Call multiple times for each symbol. UI displays: Price, 24h Change, High/Low, Volume',
          ui_transformations: [
            {
              api_field: 'lastPrice',
              ui_display: 'Price: $43,250.00',
              calculation: '`Price: $${parseFloat(lastPrice).toFixed(2)}`'
            },
            {
              api_field: 'priceChangePercent, lastPrice, openPrice',
              ui_display: '24h Change: +3.01% (+$1,250.00)',
              calculation: '`24h Change: ${priceChangePercent >= 0 ? "+" : ""}${parseFloat(priceChangePercent).toFixed(2)}% (${(parseFloat(lastPrice) - parseFloat(openPrice)) >= 0 ? "+" : ""}$${(parseFloat(lastPrice) - parseFloat(openPrice)).toFixed(2)})`',
              formula: 'change$ = lastPrice - openPrice'
            },
            {
              api_field: 'highPrice, lowPrice',
              ui_display: '24h High/Low: $44,500.00 / $41,500.00',
              calculation: '`24h High/Low: $${parseFloat(highPrice).toFixed(2)} / $${parseFloat(lowPrice).toFixed(2)}`'
            },
            {
              api_field: 'quoteVolume',
              ui_display: '24h Volume: 125.0M USDC',
              calculation: '`24h Volume: ${(parseFloat(quoteVolume) / 1000000).toFixed(1)}M USDC`',
              formula: 'volumeDisplay = quoteVolume / 1,000,000'
            }
          ]
        }
      ],
    },
    search_results: {
      category: 'Trading',
      name: 'Search Results',
      description: 'Found markets for searched symbol',
      telegram_ui: `┌─────────────────────────────┐
│ 🔍 Search Results for "SOL" │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ ⚡ Futures Markets:          │
│ • SOLUSDT                   │
│                             │
│ Click to see details        │
│ and trade                   │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
└─────────────────────────────┘

[⚡ SOLUSDT (Perp)]
[🏰 Back to Citadel]`,
      navigation: [
        { action: 'Click SOLUSDT', to: 'position_no_open' },
        { action: 'Click Back', to: 'citadel' },
      ],
      data_flow: {
        reads: ['search_query', 'available_markets'],
        writes: ['selected_symbol'],
        validates: ['symbol_exists'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/assets/search?q={query}',
          description: 'Search for assets across all exchanges',
          response: {
            success: true,
            data: [
              {
                symbol: 'SOLUSDT',
                name: 'Solana',
                exchange: 'aster',
                baseAsset: 'SOL',
                quoteAsset: 'USDT'
              }
            ]
          },
          _note: 'Example: /assets/search?q=SOL. UI displays symbol in results list'
        }
      ],
    },
    position_no_open: {
      category: 'Trading',
      name: 'New Position Panel',
      description: 'Trading interface for opening new position',
      telegram_ui: `┌─────────────────────────────┐
│ ⚡ SOLUSDT - New Position    │
│                             │
│ 📈 Price: $142.50           │
│ 24h Change: +5.23%          │
│            (+$7.32)         │
│ 24h High/Low: $145.20 /     │
│               $138.10       │
│ 24h Volume: 45.2M USDT      │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📋 Open Orders: 0           │
│                             │
│ ⚙️  Trading Settings        │
│ • Order Type: Market        │
│ • Leverage: 10x             │
│ • Margin: Cross             │
│                             │
│ Ready to open a position?   │
└─────────────────────────────┘

[🔄 Market] [10x] [🔄 Cross]

[Long $50] [Long $200] [Long X]
[Short $50] [Short $200] [Short X]

[🎯 Set TP/SL]
[« Back to Menu] [🔄 Refresh]`,
      navigation: [
        { action: 'Click 🔄 Market/Limit', to: 'position_no_open' },
        { action: 'Click Long $50', to: 'confirm_order' },
        { action: 'Click Long $200', to: 'confirm_order' },
        { action: 'Click Long X', to: 'custom_amount' },
        { action: 'Click Short $50', to: 'confirm_order' },
        { action: 'Click Short $200', to: 'confirm_order' },
        { action: 'Click Short X', to: 'custom_amount' },
        { action: 'Click 10x', to: 'leverage_menu' },
        { action: 'Click Cross', to: 'position_no_open' },
        { action: 'Click Set TP/SL', to: 'tpsl_setup' },
        { action: 'Click Refresh', to: 'position_no_open' },
        { action: 'Click Back', to: 'citadel' },
      ],
      data_flow: {
        reads: ['market_data', 'leverage_settings', 'margin_mode'],
        writes: ['trading_state'],
        validates: ['market_active'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/ticker/{SYMBOL}?exchange={{exchangeId}}',
          description: 'Get 24h price statistics',
          response: {
            success: true,
            data: {
              symbol: 'SOLUSDT',
              lastPrice: '142.50',
              openPrice: '135.18',
              priceChangePercent: '5.23',
              highPrice: '145.20',
              lowPrice: '138.10',
              quoteVolume: '45200000'
            }
          },
          _note: 'Example: /ticker/SOLUSDT?exchange=aster. UI displays: Price, 24h Change, High/Low, Volume',
          ui_transformations: [
            {
              api_field: 'lastPrice',
              ui_display: 'Price: $142.50',
              calculation: '`Price: $${parseFloat(lastPrice).toFixed(2)}`'
            },
            {
              api_field: 'priceChangePercent, lastPrice, openPrice',
              ui_display: '24h Change: +5.23% (+$7.32)',
              calculation: '`24h Change: ${priceChangePercent >= 0 ? "+" : ""}${parseFloat(priceChangePercent).toFixed(2)}% (${(parseFloat(lastPrice) - parseFloat(openPrice)) >= 0 ? "+" : ""}$${(parseFloat(lastPrice) - parseFloat(openPrice)).toFixed(2)})`',
              formula: 'change$ = lastPrice - openPrice'
            },
            {
              api_field: 'highPrice, lowPrice',
              ui_display: '24h High/Low: $145.20 / $138.10',
              calculation: '`24h High/Low: $${parseFloat(highPrice).toFixed(2)} / $${parseFloat(lowPrice).toFixed(2)}`'
            },
            {
              api_field: 'quoteVolume',
              ui_display: '24h Volume: 45.2M USDT',
              calculation: '`24h Volume: ${(parseFloat(quoteVolume) / 1000000).toFixed(1)}M USDT`',
              formula: 'volumeDisplay = quoteVolume / 1,000,000'
            }
          ]
        },
        {
          method: 'GET',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Get open orders for symbol',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                orderId: '123456789',
                symbol: 'SOLUSDT',
                side: 'BUY',
                type: 'LIMIT',
                origQty: '10.00000000',
                price: '140.00',
                status: 'NEW',
                time: 1734307200000,
                timeInForce: 'GTC'
              }
            ]
          },
          _note: 'UI displays: "Open Orders: N" count. Empty array if no orders.'
        },
        {
          method: 'POST',
          path: '/account/leverage',
          description: 'Set leverage (if changed)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            leverage: 10,
            exchange: '{{exchangeId}}'
          }
        },
        {
          method: 'POST',
          path: '/account/margin-mode',
          description: 'Set margin mode (if changed)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            mode: 'CROSS | ISOLATED',
            exchange: '{{exchangeId}}'
          }
        }
      ],
    },
    position_with_open: {
      category: 'Trading',
      name: 'Position Management',
      description: 'Managing an existing open position',
      telegram_ui: `┌─────────────────────────────┐
│ ⚡ Manage SOLUSDT Position   │
│                             │
│ Current: $5,000.00          │
│ (35.08 SOL) @ $142.50       │
│ LONG 🟢                     │
│                             │
│ PnL: +$152.30 (+15.23%)     │
│ Mark Price: $142.67         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 🎯 TP/SL Status             │
│                             │
│ TP: $155.00 (+8.77%)        │
│ SL: $135.00 (-5.26%)        │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📋 Open Orders (2)          │
│                             │
│ 1. Buy Limit [GTC]          │
│    (Dec 18, 14:30)          │
│    10 SOL @ $140.00         │
│    ($1,400 USDT)            │
│                             │
│ 2. Sell Take Profit Market  │
│    (Dec 18, 15:45)          │
│    Size: Close All          │
│    (35.08 SOL)              │
│    Trigger: Mark ≥ $155.00  │
│      → Market               │
│                             │
│ +1 more...                  │
└─────────────────────────────┘
 
[🔄 Market] [10x] [Cross]

[Ape $50] [Ape $200] [Ape X]
[Close All]
[Sell 25%] [Sell 69%] [Sell X]

[🎯 Set TP/SL] [📋 Manage Orders]
[« Back to Menu] [🔄 Refresh]`,
      navigation: [
        { action: 'Click 🔄 Market/Limit', to: 'position_with_open' },
        { action: 'Click Ape $50', to: 'confirm_add' },
        { action: 'Click Ape $200', to: 'confirm_add' },
        { action: 'Click Ape X', to: 'custom_amount' },
        { action: 'Click Close All', to: 'confirm_close' },
        { action: 'Click Sell 25%', to: 'confirm_close' },
        { action: 'Click Sell 69%', to: 'confirm_close' },
        { action: 'Click Sell X', to: 'custom_sell' },
        { action: 'Click Cross/Isolated toggle', to: 'position_with_open' },
        { action: 'Click Set TP/SL', to: 'tpsl_manager' },
        { action: 'Click Manage Orders', to: 'order_list' },
        { action: 'Click 10x', to: 'leverage_menu' },
        { action: 'Click Refresh', to: 'position_with_open' },
        { action: 'Click Back', to: 'citadel' },
      ],
      data_flow: {
        reads: ['position_data', 'open_orders', 'tpsl_orders', 'current_price'],
        writes: [],
        validates: ['position_exists'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/positions?exchange={{exchangeId}}',
          description: 'Get position details',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                symbol: 'SOLUSDT',
                positionAmt: '35.08000000',
                entryPrice: '142.50',
                markPrice: '142.67',
                unRealizedProfit: '152.30',
                leverage: '10',
                marginType: 'CROSS',
                notional: '5000.00',
                liquidationPrice: '127.75',
                margin: '500.00'
              }
            ]
          },
          _note: 'UI displays: Current size, Entry, PnL, Mark Price, Leverage, Margin Type. Filter by symbol.',
          ui_transformations: [
            {
              api_field: 'positionAmt, markPrice',
              ui_display: 'Current: $5,000.00 (35.08 SOL)',
              calculation: '`Current: $${(Math.abs(parseFloat(positionAmt)) * parseFloat(markPrice)).toFixed(2)} (${Math.abs(parseFloat(positionAmt)).toFixed(2)} ${baseAsset})`',
              formula: 'positionValue = Math.abs(positionAmt) * markPrice'
            },
            {
              api_field: 'entryPrice',
              ui_display: '@ $142.50',
              calculation: '`@ $${parseFloat(entryPrice).toFixed(2)}`'
            },
            {
              api_field: 'unRealizedProfit, margin',
              ui_display: 'PnL: +$152.30 (+15.23%)',
              calculation: '`PnL: ${unRealizedProfit >= 0 ? "+" : ""}$${parseFloat(unRealizedProfit).toFixed(2)} (${(parseFloat(unRealizedProfit) / parseFloat(margin) * 100) >= 0 ? "+" : ""}${(parseFloat(unRealizedProfit) / parseFloat(margin) * 100).toFixed(2)}%)`',
              formula: 'ROE% = (unRealizedProfit / margin) * 100'
            },
            {
              api_field: 'markPrice',
              ui_display: 'Mark Price: $142.67',
              calculation: '`Mark Price: $${parseFloat(markPrice).toFixed(2)}`'
            },
            {
              api_field: 'leverage, marginType',
              ui_display: 'Leverage: 10x Cross',
              calculation: '`Leverage: ${leverage}x ${marginType === "CROSS" ? "Cross" : "Isolated"}`'
            }
          ]
        },
        {
          method: 'GET',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Get open orders and TP/SL orders',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                orderId: '123456789',
                symbol: 'SOLUSDT',
                side: 'BUY',
                type: 'LIMIT',
                origQty: '10.00000000',
                price: '140.00',
                status: 'NEW',
                time: 1734307200000,
                timeInForce: 'GTC',
                workingType: 'CONTRACT_PRICE'
              },
              {
                orderId: '123456790',
                symbol: 'SOLUSDT',
                side: 'SELL',
                type: 'TAKE_PROFIT_MARKET',
                stopPrice: '155.00',
                status: 'NEW',
                time: 1734313500000,
                closePosition: true,
                reduceOnly: true,
                workingType: 'MARK_PRICE'
              }
            ]
          },
          _note: 'Filter TP/SL: type === TAKE_PROFIT_MARKET/STOP_MARKET && (closePosition || reduceOnly). UI formats orders with timestamps.',
          ui_transformations: [
            {
              api_field: 'side, type, timeInForce',
              ui_display: 'Buy Limit [GTC]',
              calculation: '`${side === "BUY" ? "Buy" : "Sell"} ${type.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}${timeInForce ? " [" + timeInForce + "]" : ""}`'
            },
            {
              api_field: 'origQty, price, baseAsset',
              ui_display: '10 SOL @ $140.00 ($1,400 USDT)',
              calculation: '`${parseFloat(origQty)} ${baseAsset} @ $${parseFloat(price).toFixed(2)} ($${(parseFloat(origQty) * parseFloat(price)).toFixed(2)} USDT)`',
              formula: 'orderValue = origQty * price'
            },
            {
              api_field: 'time',
              ui_display: '(Dec 18, 14:30)',
              calculation: '`(${new Date(time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })})`',
              formula: 'Format timestamp: time is in milliseconds'
            },
            {
              api_field: 'stopPrice, workingType, side',
              ui_display: 'Trigger: Mark ≥ $155.00 → Market',
              calculation: '`Trigger: ${workingType === "MARK_PRICE" ? "Mark Price" : "Last Price"} ${side === "SELL" ? "≥" : "≤"} $${parseFloat(stopPrice).toFixed(2)} → Market`',
              _note: 'For TAKE_PROFIT: SELL uses ≥, BUY uses ≤. For STOP: SELL uses ≤, BUY uses ≥'
            },
            {
              api_field: 'closePosition, origQty',
              ui_display: 'Size: Close All',
              calculation: '`Size: ${closePosition ? "Close All" : origQty + " " + baseAsset}`'
            },
            {
              api_field: 'data.length',
              ui_display: 'Open Orders (2)',
              calculation: '`Open Orders (${orders.length})`',
              _note: 'Count array length for order count display'
            }
          ]
        },
        {
          method: 'GET',
          path: '/ticker/{SYMBOL}?exchange={{exchangeId}}',
          description: 'Get current mark price',
          response: {
            success: true,
            data: {
              symbol: 'SOLUSDT',
              lastPrice: '142.67',
              markPrice: '142.67'
            }
          },
          _note: 'UI displays markPrice for position management'
        },
        {
          method: 'POST',
          path: '/position/margin',
          description: 'Add/Remove margin (isolated positions only)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            amount: '100',
            type: 'ADD | REMOVE',
            exchange: '{{exchangeId}}'
          },
          _note: 'Only works in ISOLATED margin mode. Use ADD to prevent liquidation, REMOVE to free capital.',
          ui_transformations: [
            {
              api_field: 'amount, type',
              ui_display: 'Add Margin: +$100',
              calculation: '`${type === "ADD" ? "Add" : "Remove"} Margin: ${type === "ADD" ? "+" : "-"}$${parseFloat(amount).toFixed(2)}`'
            },
            {
              api_field: 'margin, amount, type',
              ui_display: 'New Margin: $600.00',
              calculation: '`New Margin: $${(parseFloat(margin) + (type === "ADD" ? parseFloat(amount) : -parseFloat(amount))).toFixed(2)}`',
              formula: 'newMargin = currentMargin + (type === "ADD" ? amount : -amount)'
            },
            {
              api_field: 'liquidationPrice (recalculated)',
              ui_display: 'New Liquidation: $125.00',
              calculation: '`New Liquidation: $${parseFloat(newLiquidationPrice).toFixed(2)}`',
              _note: 'Liquidation price changes when margin is added/removed'
            }
          ]
        }
      ],
    },
    confirm_add: {
      category: 'Trading',
      name: 'Confirm Add to Position',
      description: 'Confirm adding more size to an existing position',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Operation        │
│                             │
│ Add to existing LONG        │
│ position on SOLUSDT         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📊 Current Position         │
│ Size: $5,000.00 (35.08 SOL) │
│ Entry: $142.50              │
│ PnL: +$152.30 (+15.23%)     │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📝 Add Amount               │
│ From quick action:          │
│   "Ape $50"                 │
│                             │
│ New Order:                  │
│   Side: 🟢 Long             │
│   Type: MARKET              │
│   Size: $50.00 USDT         │
│                             │
│ ⚙️  Settings                │
│ Leverage: 10x               │
│ Margin: Cross               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 🧮 Impact (Estimated)       │
│ New Position Size: $5,050   │
│ Additional Margin: $5.00    │
│ Liquidation moves to:       │
│   $127.10 (approx)          │
│ Fee (0.02%): $0.01          │
│                             │
│ 🚨 HIGH RISK OPERATION      │
│  Double check before       │
│  aping in more size.       │
└─────────────────────────────┘

[✅ Confirm Add] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm Add', to: 'executing' },
        { action: 'Click Cancel', to: 'position_with_open' },
      ],
      data_flow: {
        reads: ['position_data', 'order_params', 'current_price'],
        writes: ['order_locked'],
        validates: ['sufficient_margin'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/order',
          description: 'Add to position (regular order, not reduceOnly)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            side: 'BUY | SELL',
            type: 'MARKET',
            quantity: '0.002',
            exchange: '{{exchangeId}}',
            _note: 'For adding to LONG: side=BUY, for SHORT: side=SELL'
          }
        }
      ],
    },
    confirm_close: {
      category: 'Trading',
      name: 'Confirm Close Position',
      description: 'Confirm closing all or part of the position',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Close            │
│                             │
│ Close existing position     │
│ on SOLUSDT                  │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📊 Position Summary         │
│ Direction: LONG 🟢          │
│ Size: $5,000.00 (35.08 SOL) │
│ Entry: $142.50              │
│ Mark:  $142.67              │
│ PnL:  +$152.30 (+15.23%)    │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Close Action:               │
│ • Triggered from quick      │
│   action button             │
│   (Close All / Sell 25%)    │
│                             │
│ Close Type: MARKET          │
│ Estimated Close Value:      │
│   $5,152.30 (approx)        │
│ Estimated Fee (0.04%):      │
│   $2.06 (approx)            │
│                             │
│ After close:                │
│ • Position: 0 SOL           │
│ • Realized PnL: +$152.30    │
│ • Margin freed: $500.00     │
│                             │
│ ⚠️ This action cannot be    │
│   undone.                   │
└─────────────────────────────┘

[✅ Confirm Close] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm Close', to: 'executing' },
        { action: 'Click Cancel', to: 'position_with_open' },
      ],
      data_flow: {
        reads: ['position_data', 'current_price'],
        writes: ['order_locked'],
        validates: ['position_exists'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/position/close',
          description: 'Close entire position at market',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456793',
              symbol: 'SOLUSDT',
              side: 'SELL',
              executedQty: '35.08000000',
              avgPrice: '142.67',
              realizedPnl: '152.30',
              message: 'Position closed successfully'
            }
          },
          _note: 'Automatically closes 100% of position. UI displays: Order ID, Execution price, Realized PnL',
          ui_transformations: [
            {
              api_field: 'realizedPnl',
              ui_display: 'Realized PnL: +$152.30',
              calculation: '`Realized PnL: ${realizedPnl >= 0 ? "+" : ""}$${parseFloat(realizedPnl).toFixed(2)}`'
            },
            {
              api_field: 'avgPrice',
              ui_display: 'Close Price: $142.67',
              calculation: '`Close Price: $${parseFloat(avgPrice).toFixed(2)}`'
            },
            {
              api_field: 'executedQty',
              ui_display: 'Closed: 35.08 SOL',
              calculation: '`Closed: ${parseFloat(executedQty).toFixed(2)} ${baseAsset}`'
            }
          ]
        },
        {
          method: 'POST',
          path: '/order',
          description: 'Close partial position (alternative)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            side: 'SELL',
            type: 'MARKET',
            quantity: '0.35',
            reduceOnly: true,
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456793',
              symbol: 'SOLUSDT',
              side: 'SELL',
              executedQty: '8.77',
              avgPrice: '142.67',
              realizedPnl: '38.08'
            }
          },
          _note: 'For LONG: side=SELL, for SHORT: side=BUY. Set reduceOnly=true',
          ui_transformations: [
            {
              api_field: 'executedQty, positionAmt',
              ui_display: 'Sell 25%',
              calculation: '`Sell ${((parseFloat(executedQty) / Math.abs(parseFloat(positionAmt))) * 100).toFixed(0)}%`',
              formula: 'closePercent = (executedQty / Math.abs(positionAmt)) * 100',
              _note: 'For 25% close: quantity = positionAmt * 0.25'
            }
          ]
        }
      ],
    },
    confirm_order: {
      category: 'Trading',
      name: 'Confirm Order',
      description: 'Final confirmation before executing trade',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Operation        │
│                             │
│ Open LONG position          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📊 Order Details            │
│ Symbol: SOLUSDT             │
│ Side: 🟢 Long               │
│ Type: MARKET                │
│                             │
│ 📝 Input                    │
│ Amount: $200 USDT           │
│                             │
│ ⚙️  Settings                │
│ Leverage: 10x               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 🧮 Calculated               │
│ Quantity: ≈ 1.403508 SOL    │
│ Market Price: $142.50       │
│   (current market)          │
│ Position Value: $200.00     │
│ Margin Required: $20.00     │
│ Max Loss (100%): -$20.00    │
│ Liquidation if Mark Price:  │
│   $127.75                   │
│ Estimated Fee: $0.04        │
│   (0.02%)                   │
│                             │
│ 🚨 HIGH RISK OPERATION      │
│    Double check all         │
│    details!                 │
└─────────────────────────────┘

[✅ Confirm] [🔄 Re-calc]
[❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm', to: 'executing' },
        { action: 'Click Re-calc', to: 'confirm_order' },
        { action: 'Click Cancel', to: 'position_no_open' },
      ],
      _note: 'Re-calc button recalculates order values based on current market price without changing screen',
      data_flow: {
        reads: ['order_params', 'current_price', 'account_balance'],
        writes: ['order_locked'],
        validates: ['sufficient_margin', 'price_valid'],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/account/leverage',
          description: 'Set leverage before placing order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            leverage: 10,
            exchange: '{{exchangeId}}'
          }
        },
        {
          method: 'POST',
          path: '/order',
          description: 'Place market order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            side: 'BUY | SELL',
            type: 'MARKET',
            quantity: '0.002',
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456789',
              symbol: 'SOLUSDT',
              side: 'BUY',
              type: 'MARKET',
              status: 'FILLED',
              executedQty: '1.40350800',
              avgPrice: '142.52',
              cumulativeQuoteQty: '200.00',
              commission: '0.04'
            }
          },
          _note: 'Aster: 0.002 ETH ($5), Hyperliquid: 0.004 ETH ($10). UI displays: Order ID, Entry Price, Size, Leverage, Margin, Liquidation',
          ui_transformations: [
            {
              api_field: 'orderId',
              ui_display: 'Order ID: 123456789',
              calculation: '`Order ID: ${orderId}`'
            },
            {
              api_field: 'avgPrice',
              ui_display: 'Entry Price: $142.52',
              calculation: '`Entry Price: $${parseFloat(avgPrice).toFixed(2)}`'
            },
            {
              api_field: 'executedQty, cumulativeQuoteQty, baseAsset',
              ui_display: 'Size: 1.403 SOL ($200.00)',
              calculation: '`Size: ${parseFloat(executedQty).toFixed(3)} ${baseAsset} ($${parseFloat(cumulativeQuoteQty).toFixed(2)})`'
            },
            {
              api_field: 'commission',
              ui_display: 'Estimated Fee: $0.04 (0.02%)',
              calculation: '`Estimated Fee: $${parseFloat(commission).toFixed(2)} (${(parseFloat(commission) / parseFloat(cumulativeQuoteQty) * 100).toFixed(2)}%)`',
              formula: 'fee% = (commission / cumulativeQuoteQty) * 100'
            }
          ]
        }
      ],
    },
    executing: {
      category: 'Trading',
      name: 'Executing Order',
      description: 'Order is being sent to exchange',
      telegram_ui: `┌─────────────────────────────┐
│ ⏳ Executing Order...        │
│                             │
│ ⚡ Setting leverage: 10x...  │
│ ✅ Done                      │
│                             │
│ 📡 Submitting LONG order...  │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░        │
│                             │
│ ⏰ Waiting for fill...       │
│                             │
│ Please wait, this may take  │
│ a few seconds.              │
└─────────────────────────────┘`,
      navigation: [
        { action: 'Success', to: 'order_success' },
        { action: 'Failure', to: 'order_error' },
      ],
      data_flow: {
        reads: ['order_params'],
        writes: ['order_id', 'execution_result'],
        validates: [],
      },
      api_endpoints: [
        {
          method: 'POST',
          path: '/account/leverage',
          description: 'Set leverage (if needed)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            leverage: 10,
            exchange: '{{exchangeId}}'
          }
        },
        {
          method: 'POST',
          path: '/order',
          description: 'Submit order to exchange',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            side: 'BUY | SELL',
            type: 'MARKET | LIMIT',
            quantity: '0.002',
            exchange: '{{exchangeId}}',
            _note: 'For LIMIT orders, include price field'
          }
        }
      ],
    },
    order_success: {
      category: 'Trading',
      name: 'Order Success',
      description: 'Trade executed successfully',
      telegram_ui: `┌─────────────────────────────┐
│ ✅ Position Opened          │
│    Successfully!            │
│                             │
│ LONG SOLUSDT                │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📊 Execution Details        │
│ Order ID: 123456789         │
│ Entry Price: $142.52        │
│ Size: 1.403 SOL ($200.00)   │
│ Leverage: 10x               │
│ Margin Used: $20.00         │
│ Liquidation: $127.75        │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 💡 Next Steps               │
│ • Set TP/SL to protect      │
│   position                  │
│ • Monitor price action      │
│ • Adjust if needed          │
└─────────────────────────────┘

[🎯 Set TP/SL] [📊 View Position]
[🏰 Back to Menu]`,
      navigation: [
        { action: 'Click Set TP/SL', to: 'tpsl_manager' },
        { action: 'Click View Position', to: 'position_with_open' },
        { action: 'Click Back', to: 'citadel' },
      ],
      data_flow: {
        reads: ['execution_result'],
        writes: ['position_created'],
        validates: [],
      },
      api_endpoints: [],
    },
    tpsl_manager: {
      category: 'Advanced',
      name: 'TP/SL Manager',
      description: 'Set or modify take profit and stop loss',
      telegram_ui: `┌─────────────────────────────┐
│ 🎯 SET TP/SL                │
│                             │
│ Position: SOLUSDT LONG      │
│ Entry: $142.50              │
│ Current: $142.67            │
│ Size: $200.00 (1.403 SOL)   │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 📈 Take Profit              │
│ [+2%] [+5%] [+10%] [Custom] │
│                             │
│ 📉 Stop Loss                │
│ [-2%] [-5%] [-10%] [Custom] │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Current Settings:           │
│ TP: $155.00 (+8.77%)        │
│     → +$17.54               │
│ SL: $135.00 (-5.26%)        │
│     → -$10.52               │
│                             │
│ New settings:               │
│ TP: $160.00 (+12.28%)       │
│     → +$24.56               │
│ SL: Not set ❌              │
│                             │
│ Risk/Reward: 2.33:1         │
└─────────────────────────────┘

[✅ Set Orders] [❌ Clear All]
[🔙 Back]`,
      navigation: [
        { action: 'Click [+2%] [+5%] [+10%]', to: 'tpsl_manager' },
        { action: 'Click [-2%] [-5%] [-10%]', to: 'tpsl_manager' },
        { action: 'Click Custom (TP)', to: 'tpsl_custom' },
        { action: 'Click Custom (SL)', to: 'tpsl_custom' },
        { action: 'Click Set Orders', to: 'confirm_tpsl' },
        { action: 'Click Clear All', to: 'confirm_clear_tpsl' },
        { action: 'Click Back', to: 'position_with_open' },
      ],
      data_flow: {
        reads: ['position_data', 'existing_tpsl'],
        writes: ['tpsl_params'],
        validates: ['tp_above_entry', 'sl_below_entry'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Check existing TP/SL orders',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        },
        {
          method: 'POST',
          path: '/position/tp-sl',
          description: 'Set both TP and SL in one call',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            tp: '3500',
            sl: '2900',
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              tpOrderId: '123456791',
              slOrderId: '123456792',
              message: 'TP and SL orders placed successfully'
            }
          },
          _note: 'Can set both or just one (omit the other). UI updates TP/SL status display.',
          ui_transformations: [
            {
              api_field: 'tpOrder.stopPrice, entryPrice',
              ui_display: 'TP: $155.00 (+8.77%)',
              calculation: '`TP: $${parseFloat(tpPrice).toFixed(2)} (${((parseFloat(tpPrice) - parseFloat(entryPrice)) / parseFloat(entryPrice) * 100) >= 0 ? "+" : ""}${((parseFloat(tpPrice) - parseFloat(entryPrice)) / parseFloat(entryPrice) * 100).toFixed(2)}%)`',
              formula: 'TP% = ((tpPrice - entryPrice) / entryPrice) * 100',
              _note: 'Filter orders: type === "TAKE_PROFIT_MARKET" && (closePosition || reduceOnly)'
            },
            {
              api_field: 'slOrder.stopPrice, entryPrice',
              ui_display: 'SL: $135.00 (-5.26%)',
              calculation: '`SL: $${parseFloat(slPrice).toFixed(2)} (${((parseFloat(slPrice) - parseFloat(entryPrice)) / parseFloat(entryPrice) * 100) >= 0 ? "+" : ""}${((parseFloat(slPrice) - parseFloat(entryPrice)) / parseFloat(entryPrice) * 100).toFixed(2)}%)`',
              formula: 'SL% = ((slPrice - entryPrice) / entryPrice) * 100',
              _note: 'Filter orders: type === "STOP_MARKET" && (closePosition || reduceOnly)'
            },
            {
              api_field: 'tpPrice, slPrice, entryPrice, positionAmt, markPrice',
              ui_display: 'TP: $155.00 (+8.77%) → +$17.54',
              calculation: '`TP: $${tpPrice} (${tpPercent >= 0 ? "+" : ""}${tpPercent.toFixed(2)}%) → ${tpProfit >= 0 ? "+" : ""}$${tpProfit.toFixed(2)}`',
              formula: 'tpProfit = (tpPrice - entryPrice) * Math.abs(positionAmt)',
              _note: 'Calculate profit in $ from TP price'
            }
          ]
        },
        {
          method: 'POST',
          path: '/position/take-profit',
          description: 'Set only take-profit',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            price: '3500',
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456791',
              message: 'Take-profit order placed'
            }
          }
        },
        {
          method: 'POST',
          path: '/position/stop-loss',
          description: 'Set only stop-loss',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            price: '2900',
            exchange: '{{exchangeId}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456792',
              message: 'Stop-loss order placed'
            }
          }
        },
        {
          method: 'DELETE',
          path: '/order/{ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Remove TP/SL order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Use order ID from GET /orders response'
        }
      ],
    },
    order_list: {
      category: 'Advanced',
      name: 'Order Management',
      description: 'View and manage all open orders',
      telegram_ui: `┌─────────────────────────────┐
│ 📋 MANAGE ORDERS            │
│                             │
│ Active Orders (3):          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 1️⃣  Buy Limit [GTC]         │
│    Created: Dec 18, 14:30   │
│    Size: 10 SOL @ $140.00   │
│    Value: $1,400 USDT       │
│    Status: Working          │
│      (Mark Price)           │
│                             │
│    [View] [Cancel]          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 2️⃣  Sell Take Profit Market │
│    Created: Dec 18, 15:45   │
│    Size: Close All          │
│      (35.08 SOL)            │
│    Trigger: Mark ≥ $155.00  │
│      → Market               │
│    Status: Active           │
│                             │
│    [View] [Cancel]          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ 3️⃣  Buy Trailing Stop       │
│    Created: Dec 18, 16:20   │
│    Trail: 3.0% from $145.00 │
│    Current trigger: $140.65 │
│    Status: Active           │
│                             │
│    [View] [Cancel]          │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
└─────────────────────────────┘

[❌ Cancel All Orders]
[🔙 Back to Position]`,
      navigation: [
        { action: 'Click View (on any order)', to: 'order_detail' },
        { action: 'Click Cancel (on any order)', to: 'confirm_cancel_order' },
        { action: 'Click Cancel All Orders', to: 'confirm_cancel_all' },
        { action: 'Click Back', to: 'position_with_open' },
      ],
      data_flow: {
        reads: ['open_orders', 'order_status'],
        writes: [],
        validates: [],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Get all open orders',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: [
              {
                orderId: '123456789',
                symbol: 'SOLUSDT',
                side: 'BUY',
                type: 'LIMIT',
                origQty: '10.00000000',
                price: '140.00',
                status: 'NEW',
                time: 1734307200000,
                timeInForce: 'GTC',
                workingType: 'CONTRACT_PRICE'
              },
              {
                orderId: '123456790',
                symbol: 'SOLUSDT',
                side: 'SELL',
                type: 'TAKE_PROFIT_MARKET',
                stopPrice: '155.00',
                closePosition: true,
                reduceOnly: true,
                workingType: 'MARK_PRICE',
                time: 1734313500000
              }
            ]
          },
          _note: 'UI displays formatted order list with: Type, Side, Size, Price, Trigger conditions, Timestamp',
          ui_transformations: [
            {
              api_field: 'side, type',
              ui_display: 'Buy Limit',
              calculation: '`${side === "BUY" ? "Buy" : "Sell"} ${type.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}`'
            },
            {
              api_field: 'origQty, price',
              ui_display: 'Size: 10 SOL @ $140.00',
              calculation: '`Size: ${parseFloat(origQty)} ${baseAsset} @ $${parseFloat(price).toFixed(2)}`'
            },
            {
              api_field: 'origQty, price',
              ui_display: 'Value: $1,400 USDT',
              calculation: '`Value: $${(parseFloat(origQty) * parseFloat(price)).toFixed(2)} USDT`'
            },
            {
              api_field: 'time',
              ui_display: 'Created: Dec 18, 14:30',
              calculation: '`Created: ${new Date(time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`'
            },
            {
              api_field: 'status',
              ui_display: 'Status: Working',
              calculation: '`Status: ${status === "NEW" ? "Working" : status}`'
            }
          ]
        },
        {
          method: 'DELETE',
          path: '/order/{ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel single order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Replace ORDER_ID with actual order ID'
        },
        {
          method: 'DELETE',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel all orders for symbol',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        },
        {
          method: 'GET',
          path: '/orders/history?symbol={SYMBOL}&exchange={{exchangeId}}&limit=50',
          description: 'Get order history (filled, cancelled, rejected)',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Optional: View historical orders, not just open ones'
        },
        {
          method: 'GET',
          path: '/fills?symbol={SYMBOL}&exchange={{exchangeId}}&limit=50',
          description: 'Get trade execution history with fees',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Shows actual executions (one order can have multiple fills)'
        }
      ],
    },
    settings: {
      category: 'Settings',
      name: 'Settings Menu',
      description: 'Account configuration options',
      telegram_ui: `┌─────────────────────────────┐
│ ⚙️  Settings                │
│                             │
│ Choose a setting to         │
│ configure:                  │
│                             │
│ • Asset Mode                │
│   Multi-Asset / Single-Asset│
│   mode                      │
│                             │
│ • Unlink API                │
│   Disconnect your Aster DEX │
│   account                   │
└─────────────────────────────┘

[💰 Asset Mode]
[🔗 Unlink API]
[« Back to Menu]`,
      navigation: [
        { action: 'Click Asset Mode', to: 'asset_mode' },
        { action: 'Click Unlink API', to: 'confirm_unlink' },
        { action: 'Click Back', to: 'citadel' },
      ],
      data_flow: {
        reads: ['account_settings'],
        writes: [],
        validates: [],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/user/exchanges?userId={{userId}}',
          description: 'Get linked exchanges',
          _note: 'No auth required for this endpoint'
        },
        {
          method: 'POST',
          path: '/auth/session/switch',
          description: 'Switch active exchange',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            exchange: 'aster | hyperliquid'
          }
        },
        {
          method: 'DELETE',
          path: '/user/credentials?userId={{userId}}&exchange={exchange}',
          description: 'Unlink exchange account',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: '⚠️ MISSING: This endpoint needs to be added to backend API'
        }
      ],
    },
    help: {
      category: 'Settings',
      name: 'Help & Documentation',
      description: 'Guide and support resources',
      telegram_ui: `┌─────────────────────────────┐
│ 📚 Help & Documentation     │
│                             │
│ Trading Features:           │
│ • Market & Limit Orders     │
│   (Spot & Futures)          │
│ • Take Profit & Stop Loss   │
│ • Position Management       │
│ • Leverage Control          │
│   (1x-125x)                 │
│ • Margin Type               │
│   (Cross/Isolated)          │
│                             │
│ Important Notes:            │
│ • Cross margin shares       │
│   margin across all         │
│   positions                 │
│ • Isolated margin requires  │
│   Single-Asset Mode         │
│ • Always use stop losses    │
│   for risk management       │
│                             │
│ Commands:                   │
│ /menu - Main dashboard      │
│ /help - This help           │
│ [SYMBOL] - Search symbol    │
│                             │
│ Documentation:              │
│ 📖 Trading Guide            │
│ 💬 Support                  │
│ 🔐 Security                 │
└─────────────────────────────┘

[⚙️ Settings] [🏰 Menu]`,
      navigation: [
        { action: 'Click Settings', to: 'settings' },
        { action: 'Click Menu', to: 'citadel' },
      ],
      data_flow: {
        reads: [],
        writes: [],
        validates: [],
      },
      api_endpoints: [],
    },
    custom_amount: {
      category: 'Trading',
      name: 'Custom Amount Input',
      description: 'User enters custom trade amount',
      telegram_ui: `┌─────────────────────────────┐
│ 💰 Enter Custom Amount       │
│                             │
│ Symbol: SOLUSDT             │
│ Side: 🟢 Long               │
│ Type: MARKET                │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Enter amount in USDT:        │
│                             │
│ Minimum: $5.00              │
│ Maximum: $10,000.00          │
│                             │
│ Current balance:            │
│ Available: $4,234.50        │
│                             │
│ 💡 Quick amounts:           │
│ [$50] [$100] [$500] [$1000] │
│                             │
│ Or type custom amount:      │
│ [________]                  │
└─────────────────────────────┘

[❌ Cancel]`,
      navigation: [
        { action: 'User types amount', to: 'confirm_order' },
        { action: 'Click quick amount ($50/$100/$500/$1000)', to: 'confirm_order' },
        { action: 'Click Cancel', to: 'position_no_open' },
      ],
      data_flow: {
        reads: ['user_input', 'account_balance', 'current_price'],
        writes: ['custom_amount'],
        validates: ['min_amount', 'max_amount', 'sufficient_balance'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/account?exchange={{exchangeId}}',
          description: 'Get available balance',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        }
      ],
    },
    custom_sell: {
      category: 'Trading',
      name: 'Custom Sell Amount',
      description: 'User enters custom sell percentage or amount',
      telegram_ui: `┌─────────────────────────────┐
│ 💰 Custom Sell Amount       │
│                             │
│ Position: SOLUSDT LONG      │
│ Current Size: 35.08 SOL     │
│ ($5,000.00)                 │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Choose input method:        │
│                             │
│ [%] Percentage              │
│ [Amount] USDT Value         │
│ [Size] SOL Quantity         │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Enter value:                │
│ [________]                  │
│                             │
│ 💡 Examples:                │
│ • 50% = Sell half           │
│ • $1000 = Sell $1000 worth  │
│ • 10 = Sell 10 SOL          │
└─────────────────────────────┘

[❌ Cancel]`,
      navigation: [
        { action: 'User types percentage (e.g., 50)', to: 'confirm_close' },
        { action: 'User types USDT amount (e.g., 1000)', to: 'confirm_close' },
        { action: 'User types SOL quantity (e.g., 10)', to: 'confirm_close' },
        { action: 'Click Cancel', to: 'position_with_open' },
      ],
      data_flow: {
        reads: ['user_input', 'position_data', 'current_price'],
        writes: ['sell_amount'],
        validates: ['valid_percentage', 'valid_amount', 'not_exceed_position'],
      },
      api_endpoints: [],
    },
    tpsl_custom: {
      category: 'Advanced',
      name: 'Custom TP/SL Input',
      description: 'User enters custom TP/SL price or percentage',
      telegram_ui: `┌─────────────────────────────┐
│ 🎯 Custom TP/SL             │
│                             │
│ Position: SOLUSDT LONG      │
│ Entry: $142.50              │
│ Current: $142.67            │
│ Size: $200.00 (1.403 SOL)   │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Choose input method:         │
│                             │
│ [Price] Absolute Price      │
│ [%] Percentage from Entry  │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Take Profit:                │
│ [Price: $____] or [%: ___]  │
│                             │
│ Stop Loss:                  │
│ [Price: $____] or [%: ___]  │
│                             │
│ 💡 Examples:                │
│ TP: $155.00 or +8.77%       │
│ SL: $135.00 or -5.26%       │
└─────────────────────────────┘

[✅ Set] [❌ Cancel]`,
      navigation: [
        { action: 'User enters TP price/percentage', to: 'tpsl_manager' },
        { action: 'User enters SL price/percentage', to: 'tpsl_manager' },
        { action: 'Click Set', to: 'confirm_tpsl' },
        { action: 'Click Cancel', to: 'tpsl_manager' },
      ],
      data_flow: {
        reads: ['user_input', 'position_data', 'entry_price'],
        writes: ['custom_tp_price', 'custom_sl_price'],
        validates: ['tp_above_entry', 'sl_below_entry'],
      },
      api_endpoints: [],
    },
    order_detail: {
      category: 'Advanced',
      name: 'Order Details',
      description: 'Detailed view of a single order',
      telegram_ui: `┌─────────────────────────────┐
│ 📋 Order Details            │
│                             │
│ Order ID: 123456789         │
│ Symbol: SOLUSDT             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Order Information           │
│ Side: Buy                   │
│ Type: Limit                 │
│ Status: Working              │
│                             │
│ Quantity: 10.00000000 SOL   │
│ Price: $140.00              │
│ Value: $1,400.00 USDT       │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Execution Details           │
│ Filled: 0.00000000 SOL      │
│ Remaining: 10.00000000 SOL   │
│ Average Price: -             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Timing                      │
│ Created: Dec 18, 14:30      │
│ Time in Force: GTC           │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Trigger Conditions          │
│ Working Type: Contract Price│
│ Trigger: -                  │
└─────────────────────────────┘

[❌ Cancel Order]
[🔙 Back]`,
      navigation: [
        { action: 'Click Cancel Order', to: 'confirm_cancel_order' },
        { action: 'Click Back', to: 'order_list' },
      ],
      data_flow: {
        reads: ['order_id', 'order_details'],
        writes: [],
        validates: [],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Get order details by ID',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Filter by orderId to get specific order'
        }
      ],
    },
    confirm_cancel_order: {
      category: 'Advanced',
      name: 'Confirm Cancel Order',
      description: 'Confirm cancelling a single order',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Cancel Order     │
│                             │
│ Order ID: 123456789         │
│ Symbol: SOLUSDT             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Order Details               │
│ Type: Buy Limit [GTC]       │
│ Size: 10 SOL @ $140.00      │
│ Value: $1,400 USDT          │
│ Status: Working             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ ⚠️ This will cancel the     │
│    order immediately.       │
│                             │
│ The order will be removed   │
│ from the order book.        │
└─────────────────────────────┘

[✅ Confirm Cancel] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm Cancel', to: 'order_list' },
        { action: 'Click Cancel', to: 'order_detail' },
      ],
      data_flow: {
        reads: ['order_id', 'order_details'],
        writes: ['cancellation_pending'],
        validates: ['order_exists', 'order_cancellable'],
      },
      api_endpoints: [
        {
          method: 'DELETE',
          path: '/order/{ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel single order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: {
              orderId: '123456789',
              status: 'CANCELED',
              message: 'Order cancelled successfully'
            }
          }
        }
      ],
    },
    confirm_cancel_all: {
      category: 'Advanced',
      name: 'Confirm Cancel All Orders',
      description: 'Confirm cancelling all orders for symbol',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Cancel All       │
│                             │
│ Symbol: SOLUSDT             │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Orders to Cancel: 3         │
│                             │
│ 1. Buy Limit [GTC]          │
│    10 SOL @ $140.00         │
│                             │
│ 2. Sell Take Profit Market  │
│    Trigger: Mark ≥ $155.00  │
│                             │
│ 3. Buy Trailing Stop        │
│    Trail: 3.0%              │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ ⚠️ This will cancel ALL     │
│    open orders for          │
│    SOLUSDT immediately.     │
│                             │
│ This action cannot be       │
│ undone.                     │
└─────────────────────────────┘

[✅ Confirm Cancel All] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm Cancel All', to: 'order_list' },
        { action: 'Click Cancel', to: 'order_list' },
      ],
      data_flow: {
        reads: ['symbol', 'open_orders'],
        writes: ['cancellation_pending'],
        validates: ['orders_exist'],
      },
      api_endpoints: [
        {
          method: 'DELETE',
          path: '/orders?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel all orders for symbol',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          response: {
            success: true,
            data: {
              cancelledCount: 3,
              message: '3 orders cancelled successfully'
            }
          }
        }
      ],
    },
    confirm_tpsl: {
      category: 'Advanced',
      name: 'Confirm TP/SL Orders',
      description: 'Final confirmation before placing TP/SL orders',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm TP/SL Orders     │
│                             │
│ Position: SOLUSDT LONG      │
│ Entry: $142.50              │
│ Current: $142.67            │
│ Size: $200.00 (1.403 SOL)   │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ New TP/SL Settings          │
│                             │
│ Take Profit:                │
│ Price: $160.00              │
│ Percentage: +12.28%         │
│ Profit: +$24.56             │
│                             │
│ Stop Loss:                  │
│ Price: $135.00              │
│ Percentage: -5.26%          │
│ Loss: -$10.52               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Risk/Reward: 2.33:1         │
│                             │
│ ⚠️ This will place new       │
│    TP/SL orders. Existing   │
│    TP/SL orders will be     │
│    cancelled first.          │
└─────────────────────────────┘

[✅ Confirm] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm', to: 'executing' },
        { action: 'Click Cancel', to: 'tpsl_manager' },
      ],
      data_flow: {
        reads: ['tpsl_params', 'position_data', 'existing_tpsl'],
        writes: ['tpsl_orders_pending'],
        validates: ['tp_above_entry', 'sl_below_entry'],
      },
      api_endpoints: [
        {
          method: 'DELETE',
          path: '/order/{ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel existing TP/SL orders first',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        },
        {
          method: 'POST',
          path: '/position/tp-sl',
          description: 'Place new TP/SL orders',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          body: {
            symbol: 'SOLUSDT',
            tp: '160.00',
            sl: '135.00',
            exchange: '{{exchangeId}}'
          }
        }
      ],
    },
    confirm_clear_tpsl: {
      category: 'Advanced',
      name: 'Confirm Clear TP/SL',
      description: 'Confirm removing all TP/SL orders',
      telegram_ui: `┌─────────────────────────────┐
│ 🔴 Confirm Clear TP/SL      │
│                             │
│ Position: SOLUSDT LONG      │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ Current TP/SL Orders         │
│                             │
│ TP Order:                   │
│ • Order ID: 123456791       │
│ • Price: $155.00            │
│ • Status: Active            │
│                             │
│ SL Order:                   │
│ • Order ID: 123456792       │
│ • Price: $135.00            │
│ • Status: Active            │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│ ⚠️ This will cancel ALL     │
│    TP/SL orders for this    │
│    position.                │
│                             │
│ Your position will have     │
│ NO protection after this.   │
└─────────────────────────────┘

[✅ Confirm Clear] [❌ Cancel]`,
      navigation: [
        { action: 'Click Confirm Clear', to: 'executing' },
        { action: 'Click Cancel', to: 'tpsl_manager' },
      ],
      data_flow: {
        reads: ['tp_order_id', 'sl_order_id'],
        writes: ['cancellation_pending'],
        validates: ['tp_sl_exists'],
      },
      api_endpoints: [
        {
          method: 'DELETE',
          path: '/order/{TP_ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel TP order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        },
        {
          method: 'DELETE',
          path: '/order/{SL_ORDER_ID}?symbol={SYMBOL}&exchange={{exchangeId}}',
          description: 'Cancel SL order',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          }
        }
      ],
    },
    confirm_connect_hyperliquid: {
      category: 'Authentication',
      name: 'Connect Hyperliquid',
      description: 'Confirm connection to Hyperliquid exchange',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Connect Hyperliquid      │
│                             │
│ You are about to connect    │
│ Hyperliquid exchange.       │
│                             │
│ 🔸 High-leverage trading    │
│ 🔸 BTC/ETH focused          │
│ 🔸 Advanced perp options    │
│                             │
│ This will require:          │
│ • API Key or WalletConnect  │
│ • Trading permissions       │
│ • Read account balance      │
│                             │
│ 💡 Your credentials are     │
│    encrypted and secure     │
└─────────────────────────────┘

[🔗 Connect Hyperliquid]
[❌ Cancel]`,
      navigation: [
        { action: 'Click Connect Hyperliquid', to: 'exchange_selection_hyperliquid' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['current_linked_exchanges'],
        writes: ['pending_exchange_connection'],
        validates: ['exchange_not_already_linked'],
      },
      api_endpoints: [],
    },
    exchange_selection_hyperliquid: {
      category: 'Authentication',
      name: 'Link Hyperliquid',
      description: 'Choose connection method for Hyperliquid',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Link Hyperliquid         │
│                             │
│ Choose connection method:   │
│                             │
│ 🔐 WalletConnect            │
│   (Recommended)             │
│   One-click connection      │
│   via your wallet           │
│                             │
│ 🔗 API Key                  │
│   Manual setup from         │
│   Hyperliquid dashboard     │
│                             │
│ 🔒 Your credentials are     │
│    encrypted and stored     │
│    securely                 │
└─────────────────────────────┘

[🔐 WalletConnect]
[🔗 API Key]
[🔙 Back]`,
      navigation: [
        { action: 'Click WalletConnect', to: 'mini_app_auth_hyperliquid' },
        { action: 'Click API Key', to: 'link_wizard_hyperliquid' },
        { action: 'Click Back', to: 'welcome' },
      ],
      data_flow: {
        reads: ['selected_exchange'],
        writes: ['connection_method'],
        validates: ['exchange_selected'],
      },
      api_endpoints: [],
    },
    confirm_connect_aster: {
      category: 'Authentication',
      name: 'Connect Aster DEX',
      description: 'Confirm connection to Aster DEX exchange',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Connect Aster DEX        │
│                             │
│ You are about to connect    │
│ Aster DEX exchange.         │
│                             │
│ 🔸 Advanced trading features│
│ 🔸 Spot & perpetual swaps   │
│ 🔸 Competitive fees         │
│                             │
│ This will require:          │
│ • API Key or WalletConnect  │
│ • Trading permissions       │
│ • Read account balance      │
│                             │
│ 💡 Your credentials are     │
│    encrypted and secure     │
└─────────────────────────────┘

[🔗 Connect Aster DEX]
[❌ Cancel]`,
      navigation: [
        { action: 'Click Connect Aster DEX', to: 'exchange_selection_aster' },
        { action: 'Click Cancel', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['current_linked_exchanges'],
        writes: ['pending_exchange_connection'],
        validates: ['exchange_not_already_linked'],
      },
      api_endpoints: [],
    },
    exchange_selection_aster: {
      category: 'Authentication',
      name: 'Link Aster DEX',
      description: 'Choose connection method for Aster DEX',
      telegram_ui: `┌─────────────────────────────┐
│ 🔗 Link Aster DEX           │
│                             │
│ Choose connection method:   │
│                             │
│ 🔐 WalletConnect            │
│   (Recommended)             │
│   One-click connection      │
│   via your wallet           │
│                             │
│ 🔗 API Key                  │
│   Manual setup from         │
│   Aster DEX dashboard       │
│                             │
│ 🔒 Your credentials are     │
│    encrypted and stored     │
│    securely                 │
└─────────────────────────────┘

[🔐 WalletConnect]
[🔗 API Key]
[🔙 Back]`,
      navigation: [
        { action: 'Click WalletConnect', to: 'mini_app_auth_aster' },
        { action: 'Click API Key', to: 'link_wizard_aster' },
        { action: 'Click Back', to: 'welcome' },
      ],
      data_flow: {
        reads: ['selected_exchange'],
        writes: ['connection_method'],
        validates: ['exchange_selected'],
      },
      api_endpoints: [],
    },
    all_assets_universal: {
      category: 'Overview',
      name: 'All Assets (Universal)',
      description: 'View all assets across all exchanges',
      telegram_ui: `┌─────────────────────────────┐
│ 📊 All Assets (Universal)   │
│                             │
│ 🔸 Aster DEX                │
│ Balance: $3,456.78          │
│                             │
│ ASTERUSDT +12.50% (+$45.67) │
│ 10000.00000000 ASTER        │
│                             │
│ ETHUSDT -3.25% (-$23.45)    │
│ 1.50000000 ETH              │
│                             │
│ 🔸 Hyperliquid              │
│ Balance: $2,000.00          │
│                             │
│ BTC +5.50% (+$275.00)       │
│ 0.05000000 BTC              │
│                             │
│ ETH -2.25% (-$45.00)        │
│ 0.50000000 ETH              │
│                             │
│ 💬 Click any asset to       │
│    manage                   │
└─────────────────────────────┘

[🔄 Refresh] [🔙 Back]`,
      navigation: [
        { action: 'Click asset', to: 'asset_detail' },
        { action: 'Click Refresh', to: 'all_assets_universal' },
        { action: 'Click Back', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['all_exchanges_assets'],
        writes: ['universal_assets_cache'],
        validates: ['at_least_one_exchange_linked'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/assets?exchange={{exchangeId}}',
          description: 'Get spot assets for each exchange',
          headers: {
            Authorization: 'Bearer {{authToken}}'
          },
          _note: 'Call for each linked exchange',
        }
      ],
    },
    search_prompt_universal: {
      category: 'Trading',
      name: 'Search Symbol (Universal)',
      description: 'Search for trading symbols across exchanges',
      telegram_ui: `┌─────────────────────────────┐
│ 🔍 Search Symbol            │
│                             │
│ Enter symbol to search:     │
│ (e.g., SOL, BTC, ETH)       │
│                             │
│ Available on:               │
│ 🔸 Aster DEX                │
│ 🔸 Hyperliquid              │
│                             │
│ 💬 Search will find the     │
│    symbol on available      │
│    exchanges                │
└─────────────────────────────┘

[🔙 Back]`,
      navigation: [
        { action: 'User types symbol', to: 'search_results_universal' },
        { action: 'Click Back', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['user_input'],
        writes: ['search_query'],
        validates: ['symbol_format'],
      },
      api_endpoints: [],
    },
    search_results_universal: {
      category: 'Trading',
      name: 'Search Results (Universal)',
      description: 'Found markets for searched symbol across exchanges',
      telegram_ui: `┌─────────────────────────────┐
│ 🔍 Search Results for "SOL" │
│                             │
│ 🔸 Aster DEX                │
│ SOLUSDT $142.50             │
│ +5.23% (+$7.32) 24h         │
│ Volume: 45.2M USDT          │
│                             │
│ 🔸 Hyperliquid              │
│ SOL $141.80                 │
│ +4.89% (+$6.95) 24h         │
│ Volume: 12.5M USDC          │
│                             │
│ 💬 Click exchange to trade  │
└─────────────────────────────┘

[🔸 Aster DEX] [🔸 Hyperliquid]
[🔍 New Search] [🔙 Back]`,
      navigation: [
        { action: 'Click Aster DEX', to: 'position_no_open' },
        { action: 'Click Hyperliquid', to: 'position_no_open' },
        { action: 'Click New Search', to: 'search_prompt_universal' },
        { action: 'Click Back', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['search_query', 'all_exchanges_markets'],
        writes: ['search_results_cache'],
        validates: ['symbol_exists_on_at_least_one_exchange'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/ticker/{SYMBOL}?exchange={{exchangeId}}',
          description: 'Get price data for symbol on each exchange',
          _note: 'Call for each linked exchange',
        }
      ],
    },
    settings_universal: {
      category: 'Settings',
      name: 'Universal Settings',
      description: 'Global settings for all exchanges',
      telegram_ui: `┌─────────────────────────────┐
│ ⚙️ Universal Settings       │
│                             │
│ 🌐 Global Preferences:      │
│                             │
│ 🔸 Default Exchange:        │
│   Aster DEX                 │
│                             │
│ 🔸 Theme:                   │
│   Dark Mode                 │
│                             │
│ 🔸 Notifications:           │
│   All Enabled               │
│                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                             │
│ Exchange-Specific Settings: │
│                             │
│ 💬 Configure settings for   │
│    each exchange below      │
└─────────────────────────────┘

[🔸 Aster Settings] [🔸 Hyperliquid]
[🔄 Reset All] [🔙 Back]`,
      navigation: [
        { action: 'Click Aster Settings', to: 'settings' },
        { action: 'Click Hyperliquid Settings', to: 'settings' },
        { action: 'Click Reset All', to: 'confirm_reset_settings' },
        { action: 'Click Back', to: 'universal_citadel' },
      ],
      data_flow: {
        reads: ['global_settings', 'exchange_settings'],
        writes: ['universal_settings_cache'],
        validates: ['settings_format'],
      },
      api_endpoints: [
        {
          method: 'GET',
          path: '/settings?userId={{userId}}',
          description: 'Get universal user settings',
        },
        {
          method: 'PUT',
          path: '/settings?userId={{userId}}',
          description: 'Update universal settings',
          body: {
            defaultExchange: 'aster',
            theme: 'dark',
            notifications: true
          },
        }
      ],
    },
  };


export type ScreenKey = keyof typeof AGENTIFI_SCREENS;
