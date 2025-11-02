-- This schema is designed for SQLite
-- It's idempotent, so it can be run multiple times without causing errors.

-- Users table to store authentication and credit information
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    -- Storing credits as an integer (in cents) to avoid floating point issues
    credits INTEGER NOT NULL DEFAULT 500, -- New users start with $5.00 (500 cents)
    subscription_ends_at DATETIME,
    subscription_type VARCHAR(50),
    updated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table to store chat history
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL, -- To group messages in a single conversation
    role TEXT NOT NULL CHECK(role IN ('user', 'model')), -- 'user' or 'model' (AI)
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('general', 'diagnosis')), -- Type of interaction
    cost INTEGER NOT NULL, -- Cost of this message/interaction in cents
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Transactions table for better payment tracking
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    credits INTEGER NOT NULL DEFAULT 0,
    reference VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    type VARCHAR(50) NOT NULL DEFAULT 'one_time', -- 'one_time', 'subscription'
    subscription_type VARCHAR(50),
    subscription_ends_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for performance on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);