/**
 * Collections (cobranzas): a bank transfer received from a client and the invoices it pays.
 * Created on startup because migrations are not run on deploy.
 */
export const CREATE_COLLECTIONS_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS "collections" (
    "id" SERIAL PRIMARY KEY,
    "date" date NOT NULL,
    "clientId" integer NULL REFERENCES "clients"("id") ON DELETE SET NULL,
    "clientName" character varying(255),
    "clientRut" character varying(20),
    "currency" character varying(3) NOT NULL,
    "amountReceived" numeric(14,2) NOT NULL,
    "bank" character varying(60),
    "reference" character varying(100),
    "cost" numeric(14,2) NOT NULL DEFAULT 0,
    "purchaseTax" numeric(14,2) NOT NULL DEFAULT 0,
    "licitationId" integer NULL REFERENCES "licitations"("id") ON DELETE SET NULL,
    "notes" text,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "IDX_collections_date" ON "collections" ("date");
  CREATE TABLE IF NOT EXISTS "collection_invoices" (
    "collectionId" integer NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
    "billingDocumentId" integer NOT NULL REFERENCES "billing_documents"("id") ON DELETE CASCADE,
    PRIMARY KEY ("collectionId", "billingDocumentId")
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "UQ_collection_invoices_document" ON "collection_invoices" ("billingDocumentId");
`;
