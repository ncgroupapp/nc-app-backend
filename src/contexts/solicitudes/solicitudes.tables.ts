/**
 * SQL that creates the Solicitudes tables if they do not exist.
 * Shared by the migration and by the service on startup, so the feature works
 * even when migrations are not run as part of the deploy.
 */
export const CREATE_SOLICITUDES_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS "mail_accounts" (
    "id" SERIAL PRIMARY KEY,
    "email" character varying(255) NOT NULL UNIQUE,
    "provider" character varying(20) NOT NULL DEFAULT 'gmail',
    "encryptedRefreshToken" text,
    "labelName" character varying(100) NOT NULL DEFAULT 'Solicitudes,Cotizaciones',
    "active" boolean NOT NULL DEFAULT true,
    "needsReconnect" boolean NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP,
    "lastError" text,
    "lastErrorAt" TIMESTAMP,
    "consecutiveFailures" integer NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );

  -- Watched Gmail labels: both "Solicitudes" and "Cotizaciones" (the first version used only one)
  ALTER TABLE "mail_accounts" ALTER COLUMN "labelName" SET DEFAULT 'Solicitudes,Cotizaciones';
  UPDATE "mail_accounts" SET "labelName" = 'Solicitudes,Cotizaciones' WHERE "labelName" IN ('Solicitudes', 'Cotizaciones');

  -- Only threads from a week before connecting onward are imported
  ALTER TABLE "mail_accounts" ADD COLUMN IF NOT EXISTS "importSince" TIMESTAMP;
  UPDATE "mail_accounts" SET "importSince" = "createdAt" - INTERVAL '7 days' WHERE "importSince" IS NULL;

  CREATE TABLE IF NOT EXISTS "solicitudes" (
    "id" SERIAL PRIMARY KEY,
    "mailAccountId" integer NOT NULL REFERENCES "mail_accounts"("id") ON DELETE CASCADE,
    "gmailThreadId" character varying(64) NOT NULL,
    "gmailHistoryId" character varying(64),
    "subject" character varying(998),
    "fromName" character varying(255),
    "fromEmail" character varying(255),
    "receivedAt" TIMESTAMP NOT NULL,
    "lastMessageAt" TIMESTAMP NOT NULL,
    "messagesCount" integer NOT NULL DEFAULT 0,
    "snippet" text,
    "status" character varying(20) NOT NULL DEFAULT 'nueva',
    "assignee" character varying(255),
    "notes" text,
    "unread" boolean NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_solicitudes_thread" UNIQUE ("mailAccountId", "gmailThreadId")
  );
  -- Snippets imported before HTML entities were decoded
  UPDATE "solicitudes" SET "snippet" = replace(replace(replace(replace(replace("snippet", '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&')
    WHERE "snippet" LIKE '%&%;%';
  CREATE INDEX IF NOT EXISTS "IDX_solicitudes_status" ON "solicitudes" ("status");
  CREATE INDEX IF NOT EXISTS "IDX_solicitudes_lastMessageAt" ON "solicitudes" ("lastMessageAt");

  CREATE TABLE IF NOT EXISTS "solicitud_messages" (
    "id" SERIAL PRIMARY KEY,
    "solicitudId" integer NOT NULL REFERENCES "solicitudes"("id") ON DELETE CASCADE,
    "gmailMessageId" character varying(64) NOT NULL,
    "fromName" character varying(255),
    "fromEmail" character varying(255),
    "toRecipients" text,
    "ccRecipients" text,
    "subject" character varying(998),
    "sentAt" TIMESTAMP NOT NULL,
    "bodyText" text,
    "bodyHtml" text,
    "outgoing" boolean NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_solicitud_messages_gmail" UNIQUE ("solicitudId", "gmailMessageId")
  );
  CREATE INDEX IF NOT EXISTS "IDX_solicitud_messages_solicitudId" ON "solicitud_messages" ("solicitudId");

  CREATE TABLE IF NOT EXISTS "solicitud_attachments" (
    "id" SERIAL PRIMARY KEY,
    "messageId" integer NOT NULL REFERENCES "solicitud_messages"("id") ON DELETE CASCADE,
    "gmailAttachmentId" text NOT NULL,
    "filename" character varying(500) NOT NULL,
    "mimeType" character varying(255),
    "size" integer NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  -- Keep only client requests: drop threads started by the mailbox itself or before importSince
  DELETE FROM "solicitudes" s USING "mail_accounts" a
    WHERE s."mailAccountId" = a."id"
      AND (lower(s."fromEmail") = lower(a."email") OR (a."importSince" IS NOT NULL AND s."receivedAt" < a."importSince"));
  CREATE INDEX IF NOT EXISTS "IDX_solicitud_attachments_messageId" ON "solicitud_attachments" ("messageId");
`;
