# 🤖 Aster Trading Bot - Functional Architecture

**Clean, functional-style Telegram bot for Aster DEX trading**

## 🎯 Architecture

### **Pure Functions, No Classes**
- Everything is functions and modules
- No class bloat, no unnecessary abstractions
- Easy to test, easy to understand

### **Redis for Sessions (Low Latency)**
- User sessions stored in Redis
- Fast access for every message
- 30-day TTL

### **PostgreSQL for Persistent Data**
- Users, API credentials (encrypted)
- Trade history, orders
- Durable storage

## 📁 Structure

```
new-src/
├── bot.ts                 # Bot setup (functional)
├── main.ts                # Entry point
│
├── db/
│   ├── redis.ts           # Redis connection
│   ├── postgres.ts        # PostgreSQL connection
│   └── users.ts           # User database functions
│
├── middleware/
│   └── session.ts         # Redis session store
│
├── scenes/
│   └── link.scene.ts      # API linking flow (3 steps)
│
├── utils/
│   └── encryption.ts      # AES-256-GCM encryption
│
└── types/
    └── context.ts         # TypeScript types
```

## 🔄 Flow

### **Initial State (Not Linked)**
```
User: /start
Bot: Shows [Link API] [Help] buttons
```

### **Linking Flow (Scene)**
```
User: Clicks [Link API]
Bot: Enters 'link' scene

Step 1: "Send API key"
User: sends key
Bot: Stores in wizard.state.apiKey (temporary)

Step 2: "Send API secret"
User: sends secret
Bot: Validates credentials
     Encrypts with AES-256-GCM
     Saves to PostgreSQL
     Sets session.isLinked = true (Redis)
     Exits scene

User: /start
Bot: Shows [Balance] [Positions] [Trade] [Settings] [Help]
```

## 🗄️ Database Schema

### **Redis**
```
Key: session:{telegram_id}
Value: {
  userId: 123,
  telegramId: 456789,
  username: "john",
  isLinked: true
}
TTL: 30 days
```

### **PostgreSQL**

**users table:**
```sql
id SERIAL PRIMARY KEY
telegram_id BIGINT UNIQUE
username TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

**api_credentials table:**
```sql
id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(id)
api_key_encrypted TEXT
api_secret_encrypted TEXT
testnet BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

**orders table:**
```sql
id SERIAL PRIMARY KEY
user_id INTEGER
symbol TEXT
side TEXT (BUY/SELL)
type TEXT (MARKET/LIMIT)
quantity DECIMAL
price DECIMAL
status TEXT
order_id TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

## 🔐 Security

- **Encryption:** AES-256-GCM for API credentials
- **Session:** Redis-backed, 30-day expiry
- **Service User:** Dedicated PostgreSQL user (aster_bot_service)
- **No Secrets in Code:** All config in .env

## 🚀 Usage

### **Run Tests:**
```bash
bun run new-src/db/test-connections.ts
```

### **Start Bot:**
```bash
bun run new-src/main.ts
```

### **Environment:**
```bash
# .env file
DATABASE_URL=postgresql://aster_bot_service:password@localhost:5435/aster_bot
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=your_token_here
ENCRYPTION_KEY=your_32_byte_hex_key
```

## 📝 Next Steps

1. ✅ Database connections working
2. ✅ Link scene implemented
3. ✅ Session management (Redis)
4. ✅ Credential encryption (PostgreSQL)
5. ⏳ Implement Aster API client
6. ⏳ Add balance composer
7. ⏳ Add positions composer
8. ⏳ Add trading scenes

## 🎓 Key Concepts

### **Scenes = Multi-Step Flows**
```typescript
const scene = new WizardScene('name',
  step1,  // User enters
  step2,  // User responds
  step3   // Finalize & exit
);
```

### **Composers = Route Groups**
```typescript
const composer = new Composer();
composer.command('balance', handleBalance);
composer.action('balance', handleBalance);
```

### **Functional Style**
```typescript
// ❌ Class approach
class UserService {
  async getUser(id: number): Promise<User> { ... }
}

// ✅ Functional approach
export async function getUser(id: number): Promise<User> { ... }
```

## ✨ Benefits

- **Simple:** No class hierarchies
- **Fast:** Redis for sessions, PostgreSQL for data
- **Secure:** Encrypted credentials
- **Scalable:** Add scenes/composers as needed
- **Testable:** Pure functions

---

**Built with:** Telegraf, Redis, PostgreSQL, Bun, TypeScript
