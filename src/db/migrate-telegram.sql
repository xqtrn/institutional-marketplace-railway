-- Add Telegram auth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

-- Make password_hash and email optional (for Telegram-only users)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
