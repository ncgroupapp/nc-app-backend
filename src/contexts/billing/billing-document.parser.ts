import { BillingDocumentType } from "./entities/billing-document.entity";

/**
 * Reads the data of an invoice / credit note from the files the billing system (Z) exports.
 * Supports the CFE XML (DGI format) and the PDF printed representation. Everything is best effort:
 * a field that cannot be found stays null and the document is flagged for review.
 */

export interface ParsedBillingDocument {
  type: BillingDocumentType;
  cfeType: number | null;
  series: string | null;
  number: string | null;
  issueDate: string | null;
  clientName: string | null;
  clientRut: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  referenceNumber: string | null;
  needsReview: boolean;
}

/** CFE types that are not sales documents (e-Remito, e-Resguardo...) and do not belong to this module */
const NON_BILLING_CFE_TYPES = new Set([181, 182, 281, 282]);

/** Credit notes end in 2: 102 NC e-Ticket, 112 NC e-Factura, 122 NC e-Factura exportación... */
const isCreditNoteCfe = (cfeType: number) => cfeType % 10 === 2;

export class NotABillingDocumentError extends Error {}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** "1.234,56", "1,234.56", "1234.56", "1234,56", "1 234,56" → number */
export function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let value = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(value)) return null;
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma > lastDot) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    value = value.replace(/,/g, "");
  } else if (lastDot !== -1 && value.split(".").length > 2) {
    // "1.234.567" thousands with dots only
    value = value.replace(/\./g, "");
  } else if (lastDot !== -1 && /^\d{1,3}\.\d{3}$/.test(value)) {
    // "1.234" is a thousand in es-UY, never 1.234 pesos
    value = value.replace(".", "");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

/** dd/mm/yyyy, dd-mm-yyyy, dd.mm.yy or yyyy-mm-dd → yyyy-mm-dd */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!local) return null;
  const day = Number(local[1]);
  const month = Number(local[2]);
  let year = Number(local[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const xmlTag = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i"));
  return match ? match[1].trim() || null : null;
};

const xmlBlock = (xml: string, tag: string): string | null => {
  const match = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "i"));
  return match ? match[1] : null;
};

const sumAmounts = (...values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : Math.round(present.reduce((a, b) => a + b, 0) * 100) / 100;
};

const finish = (doc: Omit<ParsedBillingDocument, "needsReview">): ParsedBillingDocument => ({
  ...doc,
  needsReview: !doc.number || !doc.issueDate || doc.total === null,
});

export function parseCfeXml(xml: string): ParsedBillingDocument {
  const idDoc = xmlBlock(xml, "IdDoc") ?? xml;
  const receiver = xmlBlock(xml, "Receptor") ?? "";
  const totals = xmlBlock(xml, "Totales") ?? xml;
  const reference = xmlBlock(xml, "Referencia");

  const cfeType = Number(xmlTag(idDoc, "TipoCFE")) || null;
  if (cfeType && NON_BILLING_CFE_TYPES.has(cfeType)) {
    throw new NotABillingDocumentError(`El CFE tipo ${cfeType} no es una factura ni nota de crédito`);
  }

  const tax = sumAmounts(
    parseAmount(xmlTag(totals, "MntIVATasaMin")),
    parseAmount(xmlTag(totals, "MntIVATasaBasica")),
    parseAmount(xmlTag(totals, "MntIVAOtra")),
  );
  const total = parseAmount(xmlTag(totals, "MntTotal")) ?? parseAmount(xmlTag(totals, "MntPagar"));

  let referenceNumber: string | null = null;
  if (reference) {
    const refNumber = xmlTag(reference, "NroCFERef");
    if (refNumber) referenceNumber = [xmlTag(reference, "Serie"), refNumber].filter(Boolean).join("-");
  }

  return finish({
    type: cfeType && isCreditNoteCfe(cfeType) ? BillingDocumentType.CREDIT_NOTE : BillingDocumentType.INVOICE,
    cfeType,
    series: xmlTag(idDoc, "Serie"),
    number: xmlTag(idDoc, "Nro"),
    issueDate: parseDate(xmlTag(idDoc, "FchEmis")),
    clientName: xmlTag(receiver, "RznSocRecep"),
    clientRut: xmlTag(receiver, "DocRecep"),
    currency: xmlTag(totals, "TpoMoneda")?.toUpperCase() ?? null,
    subtotal: total !== null && tax !== null ? Math.round((total - tax) * 100) / 100 : null,
    tax,
    total,
    referenceNumber,
  });
}

const AMOUNT = String.raw`-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?`;

/** First amount that follows one of the labels, on the same line or the next one */
const amountAfter = (text: string, labels: string[]): number | null => {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[^\\d\\n-]{0,25}\\n?[^\\d\\n-]{0,10}(${AMOUNT})`));
    if (match) {
      const value = parseAmount(match[1]);
      if (value !== null) return value;
    }
  }
  return null;
};

const detectPdfCfeType = (upper: string, creditNote: boolean): number | null => {
  const exportDoc = /E-FACTURA (DE )?EXPORTACION/.test(upper);
  if (/E-FACTURA/.test(upper)) return exportDoc ? (creditNote ? 122 : 121) : creditNote ? 112 : 111;
  if (/E-TICKET/.test(upper)) return creditNote ? 102 : 101;
  return null;
};

/**
 * @param companyRut RUT of NC GROUP (the issuer), so it is not mistaken for the client's
 */
export function parsePdfText(text: string, fileName: string, companyRut?: string | null): ParsedBillingDocument {
  const upper = normalize(text);
  const upperName = normalize(fileName);

  if (/E-REMITO|E-RESGUARDO/.test(upper) && !/E-FACTURA|E-TICKET/.test(upper)) {
    throw new NotABillingDocumentError("El archivo es un e-Remito / e-Resguardo, no una factura");
  }

  const creditNote =
    /NOTA\s+DE\s+CREDITO|NOTA\s+CREDITO|N\.?\s?C\.?\s+(E-FACTURA|E-TICKET)/.test(upper) ||
    /(^|[^A-Z])(NC|NOTA[\s_-]*(DE[\s_-]*)?CREDITO)([^A-Z]|$)/.test(upperName);

  // "SERIE A NRO 0001234", "SERIE: A  NUMERO: 1234", "A - 0001234" next to the document title
  const seriesNumber =
    upper.match(/SERIE[\s:]*([A-Z]{1,2})[\s\n]*(?:N(?:RO|UMERO|º|°|O)?\.?[\s:]*)?(\d{1,10})/) ??
    upper.match(/(?:E-FACTURA|E-TICKET|CREDITO)[^\n]*\n?[^\n]*?\b([A-Z]{1,2})\s*-?\s*(\d{4,10})\b/) ??
    upperName.match(/(?:^|[^A-Z])([A-Z]{1,2})[\s_-]?(\d{4,10})(?:[^\d]|$)/);

  const dateMatch =
    upper.match(/FECHA(?:\s+DE)?(?:\s+EMISION)?[\s:]*\n?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})/) ??
    upper.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);

  const ruts = [...new Set(upper.match(/\b\d{12}\b/g) ?? [])];
  const ownRut = companyRut?.replace(/\D/g, "");
  const clientRut = ruts.find((rut) => rut !== ownRut && (ownRut || rut !== ruts[0])) ?? (ownRut ? null : ruts[0] ?? null);

  // Client name: line after "RAZON SOCIAL" / "CLIENTE" / "NOMBRE" (taken from the original text to keep its case)
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let clientName: string | null = null;
  for (let i = 0; i < lines.length && !clientName; i++) {
    const label = normalize(lines[i]).match(/^(RAZON SOCIAL|CLIENTE|NOMBRE|SENOR(?:ES)?|SR\.?\(ES\)?)\s*:?\s*(.*)$/);
    if (!label) continue;
    const inline = lines[i].slice(lines[i].length - label[2].length).trim();
    const candidate = inline || lines[i + 1] || "";
    if (candidate && !/^\d+$/.test(candidate) && !/RUT/i.test(candidate)) clientName = candidate.slice(0, 255);
  }

  const currency = /\bUSD\b|U\$S|US\$|DOLAR/.test(upper)
    ? "USD"
    : /\bUYU\b|PESOS?\s+URUGUAYOS?|\$U?\b/.test(upper)
      ? "UYU"
      : null;

  const total = amountAfter(upper, ["TOTAL\\s+A\\s+PAGAR", "TOTAL\\s+(?:USD|UYU|U\\$S|\\$)", "IMPORTE\\s+TOTAL", "\\bTOTAL\\b"]);
  const tax = amountAfter(upper, ["IVA\\s+(?:TASA\\s+)?BASICA", "IVA\\s+22\\s?%", "TOTAL\\s+IVA", "\\bIVA\\b"]);
  const subtotal = amountAfter(upper, ["SUB\\s?-?TOTAL", "NETO\\s+GRAVADO", "MONTO\\s+NETO"]);

  let referenceNumber: string | null = null;
  if (creditNote) {
    const ref = upper.match(/(?:REFERENCIA|REF\.?|FACTURA)[^\n]{0,30}?\b([A-Z]{1,2})\s*-?\s*(\d{4,10})\b/);
    if (ref) referenceNumber = `${ref[1]}-${ref[2].replace(/^0+(?=\d)/, "")}`;
  }

  return finish({
    type: creditNote ? BillingDocumentType.CREDIT_NOTE : BillingDocumentType.INVOICE,
    cfeType: detectPdfCfeType(upper, creditNote),
    series: seriesNumber?.[1] ?? null,
    number: seriesNumber?.[2]?.replace(/^0+(?=\d)/, "") ?? null,
    issueDate: parseDate(dateMatch?.[1]),
    clientName,
    clientRut,
    currency,
    subtotal,
    tax,
    total,
    referenceNumber,
  });
}

export const isXmlFile = (fileName: string, mimeType: string) =>
  /\.xml$/i.test(fileName) || /xml/i.test(mimeType);

export const isPdfFile = (fileName: string, mimeType: string) =>
  /\.pdf$/i.test(fileName) || mimeType === "application/pdf";
