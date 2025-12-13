-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create api_credentials table
CREATE TABLE IF NOT EXISTS api_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  exchange_id TEXT NOT NULL DEFAULT 'aster',
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  additional_data_encrypted TEXT,
  testnet BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, exchange_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_exchange_id ON api_credentials(exchange_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (true);

-- Create policies for api_credentials table
CREATE POLICY "Users can view their own credentials" ON api_credentials
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own credentials" ON api_credentials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own credentials" ON api_credentials
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own credentials" ON api_credentials
  FOR DELETE USING (true);
