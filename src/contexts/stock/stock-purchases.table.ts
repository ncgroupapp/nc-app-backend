/**
 * SQL that creates the stock_purchases table if it does not exist.
 * Shared by the migration and by StockService on startup, so the feature works
 * even when migrations are not run as part of the deploy.
 */
export const CREATE_STOCK_PURCHASES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "stock_purchases" (
    "id" SERIAL PRIMARY KEY,
    "productId" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "providerId" integer NULL REFERENCES "providers"("id") ON DELETE SET NULL,
    "providerName" character varying(255),
    "purchaseDate" date,
    "orderNumber" character varying(100),
    "quantity" numeric(10,2) NOT NULL,
    "unitCost" numeric(12,2) NOT NULL,
    "currency" character varying(3) NOT NULL DEFAULT 'USD',
    "notes" text,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "IDX_stock_purchases_productId" ON "stock_purchases" ("productId");
`;
