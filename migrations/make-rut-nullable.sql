-- Migration: Make RUT nullable in providers table
-- Date: 2026-02-23

-- Alter column to drop NOT NULL constraint
ALTER TABLE providers 
ALTER COLUMN "rut" DROP NOT NULL;
