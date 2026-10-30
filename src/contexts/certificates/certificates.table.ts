/**
 * Certificates RUPE (Registro Único de Proveedores del Estado) asks suppliers to keep up to date.
 * They are created empty on startup so the list is always there; dates and files are loaded from the app.
 */
export const RUPE_CERTIFICATES = [
  {
    code: "dgi",
    name: "Certificado Único DGI",
    issuer: "DGI",
    description: "Constancia de estar al día con DGI. RUPE lo controla para mantener el estado ACTIVO.",
  },
  {
    code: "bps",
    name: "Certificado Común BPS",
    issuer: "BPS",
    description: "Constancia de estar al día con BPS. RUPE lo controla para mantener el estado ACTIVO.",
  },
  {
    code: "bse",
    name: "Póliza de accidentes de trabajo BSE",
    issuer: "BSE",
    description: "Certificado de seguro de accidentes de trabajo y enfermedades profesionales (Ley 16.074).",
  },
  {
    code: "notarial",
    name: "Certificado notarial",
    issuer: "Escribano",
    description: "Vigencia de la empresa y representación de quienes la firman.",
  },
] as const;

/**
 * SQL that creates the certificates table if it does not exist and adds the RUPE certificates.
 * Shared by the migration and by CertificatesService on startup, so the feature works
 * even when migrations are not run as part of the deploy.
 */
export const CREATE_CERTIFICATES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "certificates" (
    "id" SERIAL PRIMARY KEY,
    "code" character varying(30) NULL UNIQUE,
    "name" character varying(150) NOT NULL,
    "issuer" character varying(100),
    "description" text,
    "requiredForRupe" boolean NOT NULL DEFAULT false,
    "issueDate" date,
    "expiryDate" date,
    "alertDays" integer NOT NULL DEFAULT 30,
    "notes" text,
    "fileName" character varying(255),
    "mimeType" character varying(100),
    "fileSize" integer,
    "fileData" bytea,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
  INSERT INTO "certificates" ("code", "name", "issuer", "description", "requiredForRupe") VALUES
    ${RUPE_CERTIFICATES.map(
      (c) => `('${c.code}', '${c.name}', '${c.issuer}', '${c.description.replace(/'/g, "''")}', true)`,
    ).join(",\n    ")}
  ON CONFLICT ("code") DO NOTHING;
`;
