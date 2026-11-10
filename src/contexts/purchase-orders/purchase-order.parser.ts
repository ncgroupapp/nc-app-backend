/**
 * Reads the main data of a purchase order from the text of its PDF. Built for the standard
 * order the state agencies issue (Intendencias, ministries…), which looks like:
 *
 *   R.U.C.: 160050700014                        ← the agency's RUT
 *   INICIO DE COMPRA DIRECTA: CD 2026 2796      ← the purchase it comes from
 *   OC 2026 4357                                ← order number
 *   Principal
 *   01/09/26                                    ← order date
 *   ORDEN DE COMPRA
 *   Intendencia de Salto                        ← the agency
 *   TOTALUYU39.040,00                           ← currency and total
 *
 * Anything it cannot find is left null so the person fills it in.
 */

export interface ParsedPurchaseOrder {
  number: string | null;
  /** YYYY-MM-DD */
  issueDate: string | null;
  clientName: string | null;
  clientRut: string | null;
  currency: "UYU" | "USD" | null;
  total: number | null;
  /** Purchase number the order comes from, e.g. "CD 2026 2796" */
  purchaseNumber: string | null;
}

/** "39.040,00" → 39040 */
const parseAmount = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

/** "01/09/26" or "01/09/2026" → "2026-09-01" */
function parseDate(value: string): string | null {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Our own RUT appears as the supplier's; it must never be taken as the client's */
const OWN_RUT = "190323070010";

export function parsePurchaseOrder(text: string): ParsedPurchaseOrder {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result: ParsedPurchaseOrder = {
    number: null,
    issueDate: null,
    clientName: null,
    clientRut: null,
    currency: null,
    total: null,
    purchaseNumber: null,
  };

  // The PDF readers do not agree on the order of the header lines, nor on what shares a line
  // (the order number can come glued to the agency's address), so nothing here relies on
  // a value being alone on its line or on a fixed line order.
  for (const [i, line] of lines.entries()) {
    if (!result.number) {
      const number = line.match(/(?:^|\s)(?:OC|O\.C\.)\s*:?\s*(\d{4}\s+\d{1,7})(?:\s|$)/i);
      if (number) result.number = `OC ${number[1].replace(/\s+/g, " ")}`;
    }

    if (!result.clientRut) {
      const rut = line.match(/R\.?U\.?[CT]\.?\s*:?\s*(\d{12})\b/i);
      if (rut && rut[1] !== OWN_RUT) result.clientRut = rut[1];
    }

    if (!result.purchaseNumber) {
      const purchase = line.match(/INICIO DE [A-ZÁÉÍÓÚ ]+:\s*(.+)$/i);
      if (purchase) result.purchaseNumber = purchase[1].trim();
    }

    // The agency's name is next to the "ORDEN DE COMPRA" title: under it or above it
    if (!result.clientName && /^ORDEN DE COMPRA$/i.test(line)) {
      result.clientName = [lines[i + 1], lines[i - 1]].find((candidate) => candidate && looksLikeAgencyName(candidate)) ?? null;
    }

    if (result.total === null) {
      const total = line.match(/TOTAL\s*(UYU|USD|\$U|U\$S|US\$)\s*([\d.]+,\d{2})/i);
      if (total) {
        result.currency = /^(UYU|\$U)$/i.test(total[1]) ? "UYU" : "USD";
        result.total = parseAmount(total[2]);
      }
    }
  }

  // The order date is the first date printed on its own (the entry date comes later)
  for (const line of lines) {
    const date = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line) ? parseDate(line) : null;
    if (date) {
      result.issueDate = date;
      break;
    }
  }

  return result;
}

/** Not the copy type ("Principal"), a date, a column header or a line full of numbers */
function looksLikeAgencyName(line: string): boolean {
  if (/^(principal|copia|duplicado|original)$/i.test(line)) return false;
  if (/^ART[IÍ]CULO/i.test(line) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) return false;
  const letters = line.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "").length;
  return letters >= 4 && letters >= line.replace(/\s/g, "").length * 0.6;
}
