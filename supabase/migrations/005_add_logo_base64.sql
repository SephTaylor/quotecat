-- QuoteCat Migration: Add logo_base64 to profiles
-- Created: 2025-12-16
-- Description: Store company logo as base64 text directly in profiles table

-- Add logo_base64 column (stores base64-encoded image)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

-- Remove old logo_url column if it exists (we're moving away from Storage)
-- Note: Keeping this commented out in case some users have URLs stored
-- ALTER TABLE profiles DROP COLUMN IF EXISTS logo_url;
