/**
 * Rule-based reading of a request (mail text + PDF text) to prefill a licitation:
 * closing date/time, purchase number and requested items. No external services.
 */

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Words that announce when offers close / are opened. */
const DEADLINE_KEYWORDS =
  /(apertura|cierre|fecha\s+l[ií]mite|recepci[oó]n\s+de\s+(?:ofertas|cotizaciones|propuestas)|presentaci[oó]n\s+de\s+(?:ofertas|cotizaciones|propuestas)|plazo\s+(?:de\s+)?(?:entrega\s+de\s+)?(?:ofertas|cotizaci[oó]n|cotizaciones)|vence|vencimiento|hasta\s+el\s+d[ií]a|recibir[aá]n\s+(?:ofertas|cotizaciones))/i;

export interface ParsedDeadline {
  /** ISO date-time in Uruguay time (UTC-3). */
  date: string;
  hasTime: boolean;
  /** Text the date was taken from, to show the user. */
  evidence: string;
}

export interface RequestedLine {
  quantity: number | null;
  description: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds an ISO string for a local Uruguay date/time (UTC-3, no DST). */
function uyIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-03:00`;
}

function uyParts(date: Date): { year: number; month: number; day: number } {
  const local = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

function normalizeYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/** Finds a time like "10:00", "10.30 hs", "hora 9:00", "9 horas" in a snippet. */
function findTime(text: string): { hour: number; minute: number } | null {
  const match =
    text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:hs?\.?|horas?)?\b/i) ??
    text.match(/\bhora\s*:?\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\b/i) ??
    text.match(/\b([01]?\d|2[0-3])\s*(?:hs\.?|horas)\b/i);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2] ?? 0) };
}

/** Finds a date (numeric, written month, or "hoy"/"mañana") in a snippet. */
function findDate(
  text: string,
  reference: Date,
): { year: number; month: number; day: number; index: number } | null {
  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (numeric && numeric.index !== undefined) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { year: normalizeYear(Number(numeric[3])), month, day, index: numeric.index };
    }
  }
  const written = text.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/i,
  );
  if (written && written.index !== undefined) {
    const month = MONTHS[written[2]!.toLowerCase()]!;
    const year = written[3] ? Number(written[3]) : uyParts(reference).year;
    return { year, month, day: Number(written[1]), index: written.index };
  }
  const relative = text.match(/\b(hoy|ma[nñ]ana|pasado\s+ma[nñ]ana)\b/i);
  if (relative && relative.index !== undefined) {
    const word = relative[1]!.toLowerCase();
    const offset = word.startsWith("pasado") ? 2 : word === "hoy" ? 0 : 1;
    const target = uyParts(new Date(reference.getTime() + offset * 24 * 60 * 60 * 1000));
    return { ...target, index: relative.index };
  }
  return null;
}

/**
 * Looks for the closing / opening date of the request. `reference` is when the mail
 * arrived, used for "mañana" and dates without year.
 */
export function findDeadline(text: string, reference: Date): ParsedDeadline | null {
  const flat = text.replace(/[ \t]+/g, " ");
  const keyword = new RegExp(DEADLINE_KEYWORDS.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = keyword.exec(flat)) !== null) {
    const window = flat.slice(match.index, match.index + 160);
    const date = findDate(window, reference);
    if (!date) continue;
    const time = findTime(window.slice(date.index)) ?? findTime(window);
    return {
      date: uyIso(date.year, date.month, date.day, time?.hour ?? 0, time?.minute ?? 0),
      hasTime: Boolean(time),
      evidence: window.split("\n").slice(0, 2).join(" ").trim().slice(0, 140),
    };
  }
  return null;
}

/** Lines that look like "500 METROS CABLE ..." or "- 30 LUMINARIA ...": quantity + description. */
export function findRequestedLines(text: string): RequestedLine[] {
  const lines: RequestedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 6 || line.length > 200) continue;
    const match = line.match(/^[-•*]?\s*(\d{1,6}(?:[.,]\d+)?)\s*(?:u\.?|uds?\.?|unidades?|un\.?|x)?\s+([A-Za-zÁÉÍÓÚÑáéíóúñ].{4,})$/);
    if (!match) continue;
    const description = match[2]!.trim();
    // Skip phone numbers, addresses and signatures
    if (/\b(tel|int\.|email|calle|avda|av\.|piso|c\.p\.)\b/i.test(description)) continue;
    lines.push({ quantity: Number(match[1]!.replace(",", ".")), description });
  }
  return lines;
}

/**
 * Regex that finds a code as a whole token, tolerating spaces, dots, dashes and slashes
 * between its characters ("5K-0984" matches "5K 0984" but not "35K09841").
 */
export function codePattern(code: string): RegExp | null {
  const chars = normalizeCode(code).split("");
  if (chars.length === 0) return null;
  // normalizeCode leaves only A-Z and 0-9, so the characters need no escaping
  const body = chars.join("[\\s.\\-/]*");
  return new RegExp(`(?<![A-Z0-9])${body}(?![A-Z0-9])`, "i");
}

/**
 * Item lines of known pliego layouts without our codes, e.g. Intendencia de Rivera:
 * "un11083-0001SEPARADOR - Separador (distanciador) No.6", or "Adquisición de X" + "Cantidad: 1 unidad".
 */
export function findPliegoItems(text: string): RequestedLine[] {
  const items: RequestedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const rivera = raw.trim().match(/^(?:un|kg|lt|lts|mt|mts|m|par|jgo|cj)(\d{4,6}-\d{3,4})(.{3,})$/i);
    if (rivera) items.push({ quantity: null, description: `${rivera[2]!.trim()} (art. ${rivera[1]})` });
  }
  const acquisition = text.match(/(?:adquisici[oó]n|suministro|compra)\s+de\s+([^\n.]{4,120})/i);
  const quantity = text.match(/cantidad\s*:?\s*(\d{1,6})\s*(?:unidad|unidades|u\b|uds?)/i);
  if (items.length === 0 && acquisition) {
    items.push({ quantity: quantity ? Number(quantity[1]) : null, description: acquisition[1]!.trim() });
  }
  return items;
}

/** Uppercase alphanumerics only, to compare codes regardless of spaces, dots and dashes. */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Quantity written next to a code in the text, if any (e.g. "4 F. AIRE 37/AI9837"). */
export function quantityNearCode(text: string, code: string): number | null {
  for (const raw of text.split(/\r?\n/)) {
    if (!normalizeCode(raw).includes(normalizeCode(code))) continue;
    const leading = raw.trim().match(/^[-•*]?\s*(\d{1,6})(?:[.,]\d+)?\s/);
    if (leading) return Number(leading[1]);
    const labelled = raw.match(/\b(?:cant(?:idad)?\.?|qty)\s*:?\s*(\d{1,6})/i);
    if (labelled) return Number(labelled[1]);
  }
  return null;
}
