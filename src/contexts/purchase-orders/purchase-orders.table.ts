/**
 * Purchase orders (órdenes de compra) received from clients, with their PDF and the documents
 * they relate to: one licitation, and any number of invoices and remitos.
 * Created on startup because migrations are not run on deploy.
 */
export const CREATE_PURCHASE_ORDERS_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" SERIAL PRIMARY KEY,
    "number" character varying(100) NOT NULL,
    "issueDate" date,
    "clientId" integer NULL REFERENCES "clients"("id") ON DELETE SET NULL,
    "licitationId" integer NULL REFERENCES "licitations"("id") ON DELETE SET NULL,
    "currency" character varying(3),
    "total" numeric(14,2),
    "notes" text,
    "fileName" character varying(255),
    "mimeType" character varying(100),
    "fileSize" integer,
    "fileData" bytea,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "IDX_purchase_orders_issueDate" ON "purchase_orders" ("issueDate");
  CREATE TABLE IF NOT EXISTS "purchase_order_invoices" (
    "purchaseOrderId" integer NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
    "billingDocumentId" integer NOT NULL REFERENCES "billing_documents"("id") ON DELETE CASCADE,
    PRIMARY KEY ("purchaseOrderId", "billingDocumentId")
  );
  CREATE TABLE IF NOT EXISTS "purchase_order_remitos" (
    "purchaseOrderId" integer NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
    "remitoId" integer NOT NULL REFERENCES "remitos"("id") ON DELETE CASCADE,
    PRIMARY KEY ("purchaseOrderId", "remitoId")
  );
`;
