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

  for (const [i, line] of lines.entries()) {
    if (!result.number) {
      const number = line.match(/^(?:OC|O\.C\.|ORDEN DE COMPRA N[°º.]?)\s*:?\s*(\d{4}\s+\d+|\d[\d\s/-]*\d)$/i);
      if (number) result.number = `OC ${number[1].replace(/\s+/g, " ")}`;
    }

    if (!result.clientRut) {
      const rut = line.match(/^R\.?U\.?[CT]\.?\s*:?\s*(\d{12})$/i);
      if (rut && rut[1] !== OWN_RUT) result.clientRut = rut[1];
    }

    if (!result.purchaseNumber) {
      const purchase = line.match(/INICIO DE [A-ZÁÉÍÓÚ ]+:\s*(.+)$/i);
      if (purchase) result.purchaseNumber = purchase[1].trim();
    }

    // The agency's name comes right under the "ORDEN DE COMPRA" title
    if (!result.clientName && /^ORDEN DE COMPRA$/i.test(line) && lines[i + 1] && !/^ART[IÍ]CULO/i.test(lines[i + 1])) {
      result.clientName = lines[i + 1];
    }

    // The date is under the copy type ("Principal") that follows the order number
    if (!result.issueDate && /^principal$/i.test(line) && lines[i + 1]) {
      result.issueDate = parseDate(lines[i + 1]);
    }

    if (result.total === null) {
      const total = line.match(/^TOTAL\s*(UYU|USD|\$U|U\$S|US\$)\s*([\d.]+,\d{2})$/i);
      if (total) {
        result.currency = /^(UYU|\$U)$/i.test(total[1]) ? "UYU" : "USD";
        result.total = parseAmount(total[2]);
      }
    }
  }

  // Fallback for the date: the entry date some orders print
  if (!result.issueDate) {
    const entry = lines.findIndex((line) => /^Fecha de ingreso:?$/i.test(line));
    if (entry >= 0 && lines[entry + 1]) result.issueDate = parseDate(lines[entry + 1]);
  }

  return result;
}
