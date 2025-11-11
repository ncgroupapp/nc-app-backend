-- Migration: Add paymentForm and validity fields to quotations table
-- Date: 2025-11-10

-- Add new columns to quotations table
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS "paymentForm" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "validity" VARCHAR(100);

-- Add comments to the columns for documentation
COMMENT ON COLUMN quotations."paymentForm" IS 'Forma de pago de la cotización (ej: "30 días")';
COMMENT ON COLUMN quotations."validity" IS 'Validez de la cotización (ej: "30 días")';
