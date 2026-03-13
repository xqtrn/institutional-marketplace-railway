-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  permissions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deals (buy/sell)
CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  deal_type VARCHAR(10) NOT NULL,
  company VARCHAR(255) NOT NULL,
  price VARCHAR(100),
  volume VARCHAR(100),
  valuation VARCHAR(100),
  structure VARCHAR(100),
  share_class VARCHAR(100),
  series VARCHAR(100),
  management_fee DECIMAL DEFAULT 0,
  carry DECIMAL DEFAULT 0,
  partner VARCHAR(255),
  partner_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'manual',
  status VARCHAR(50) DEFAULT 'active',
  last_update TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline
CREATE TABLE IF NOT EXISTS pipeline (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  deal_type VARCHAR(10),
  stage VARCHAR(50) DEFAULT 'new_lead',
  price VARCHAR(100),
  volume VARCHAR(100),
  valuation VARCHAR(100),
  structure VARCHAR(100),
  share_class VARCHAR(100),
  partner VARCHAR(255),
  partner_email VARCHAR(255),
  probability INTEGER DEFAULT 20,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  source_id INTEGER,
  email_threads JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline History
CREATE TABLE IF NOT EXISTS pipeline_history (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER REFERENCES pipeline(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50),
  field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  trigger VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Partners
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Issuers
CREATE TABLE IF NOT EXISTS issuers (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Changelog
CREATE TABLE IF NOT EXISTS changelog (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  deal_type VARCHAR(10),
  deal_id INTEGER,
  company VARCHAR(255),
  previous_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Logos
CREATE TABLE IF NOT EXISTS logos (
  company VARCHAR(255) PRIMARY KEY,
  url TEXT NOT NULL
);

-- Auto-update logs
CREATE TABLE IF NOT EXISTS auto_update_logs (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-update results
CREATE TABLE IF NOT EXISTS auto_update_results (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-update queue
CREATE TABLE IF NOT EXISTS auto_update_queue (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deals_type ON deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_company ON pipeline(company);
CREATE INDEX IF NOT EXISTS idx_changelog_created ON changelog(created_at DESC);
