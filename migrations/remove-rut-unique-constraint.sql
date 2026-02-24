-- Migration: Remove UNIQUE constraint from rut in providers table
-- Date: 2026-02-24

DO $$ 
DECLARE 
    constraint_name_var text;
BEGIN 
    SELECT con.conname
    INTO constraint_name_var
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    INNER JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'providers'
      AND att.attname = 'rut'
      AND con.contype = 'u';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE providers DROP CONSTRAINT "' || constraint_name_var || '"';
    END IF;
END $$;
