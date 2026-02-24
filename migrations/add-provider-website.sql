-- Migration: Add website field to providers table
-- Date: 2026-02-23

-- Add new column to providers table
ALTER TABLE providers 
ADD COLUMN IF NOT EXISTS "website" VARCHAR(255);

-- Add comment to the column for documentation
COMMENT ON COLUMN providers."website" IS 'Provider website URL';
