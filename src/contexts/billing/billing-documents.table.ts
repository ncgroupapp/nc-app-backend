/**
 * SQL that creates the billing_documents table if it does not exist.
 * Shared by the migration and by BillingService on startup, so the feature works
 * even when migrations are not run as part of the deploy.
 */
export const CREATE_BILLING_DOCUMENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "billing_documents" (
    "id" SERIAL PRIMARY KEY,
    "type" character varying(20) NOT NULL,
    "cfeType" integer NULL,
    "series" character varying(10),
    "number" character varying(30),
    "issueDate" date,
    "clientName" character varying(255),
    "clientRut" character varying(20),
    "currency" character varying(3),
    "subtotal" numeric(14,2),
    "tax" numeric(14,2),
    "total" numeric(14,2),
    "referenceNumber" character varying(50),
    "source" character varying(20) NOT NULL DEFAULT 'carpeta',
    "fileName" character varying(255) NOT NULL,
    "mimeType" character varying(100) NOT NULL,
    "fileSize" integer NOT NULL,
    "fileHash" character varying(64) NOT NULL,
    "fileData" bytea NOT NULL,
    "needsReview" boolean NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  ALTER TABLE "billing_documents" ADD COLUMN IF NOT EXISTS "rawText" text;
  CREATE UNIQUE INDEX IF NOT EXISTS "UQ_billing_documents_fileHash" ON "billing_documents" ("fileHash");
  CREATE INDEX IF NOT EXISTS "IDX_billing_documents_issueDate" ON "billing_documents" ("issueDate");
  CREATE INDEX IF NOT EXISTS "IDX_billing_documents_type" ON "billing_documents" ("type");
`;
