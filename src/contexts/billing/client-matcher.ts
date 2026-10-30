/**
 * Links the client read from an invoice to a client already loaded in the app:
 * first by RUT (exact, ignoring dots and dashes), then by name (ignoring case, accents,
 * punctuation and legal suffixes like S.A. / S.R.L.), including acronyms such as
 * "ASSE" for "Administración de los Servicios de Salud del Estado".
 */

export interface MatchableClient {
  id: number;
  name: string;
  identifier: string | null;
}

export type ClientMatchKind = "rut" | "nombre";

export interface ClientMatch {
  clientId: number;
  by: ClientMatchKind;
}

const LEGAL_SUFFIXES = /\b(S\s?A\s?S|S\s?R\s?L|S\s?A|LTDA|SOCIEDAD ANONIMA|SOCIEDAD DE RESPONSABILIDAD LIMITADA|SOCIEDAD POR ACCIONES SIMPLIFICADA|LIMITADA|S\s?C|SOCIEDAD COLECTIVA)\b/g;
const STOPWORDS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "E", "EN", "PARA", "POR"]);

export const normalizeRut = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.,]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (name: string) => name.split(" ").filter((word) => word && !STOPWORDS.has(word));

/** "ADMINISTRACION SERVICIOS SALUD ESTADO" → "ASSE" */
const acronym = (name: string) => words(name).map((word) => word[0]).join("");

/** 0 (nothing in common) to 1 (same name) */
function nameScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const compactA = a.replace(/ /g, "");
  const compactB = b.replace(/ /g, "");
  if (compactA === compactB) return 1;

  // One is the acronym of the other: "ASSE" ↔ "ADMINISTRACION DE LOS SERVICIOS DE SALUD DEL ESTADO"
  if (!a.includes(" ") && a.length >= 3 && acronym(b) === a) return 0.95;
  if (!b.includes(" ") && b.length >= 3 && acronym(a) === b) return 0.95;

  const wordsA = new Set(words(a));
  const wordsB = new Set(words(b));
  const common = [...wordsA].filter((word) => wordsB.has(word)).length;
  if (common === 0) return 0;
  // Every word of the shorter name is in the longer one: "HOSPITAL MACIEL" ↔ "HOSPITAL MACIEL ASSE"
  const smaller = Math.min(wordsA.size, wordsB.size);
  if (common === smaller && smaller >= 2) return 0.9;
  if (common === smaller && smaller === 1 && Math.min(compactA.length, compactB.length) >= 6) return 0.85;
  return common / Math.max(wordsA.size, wordsB.size);
}

const NAME_THRESHOLD = 0.85;

export function matchClient(
  document: { clientRut?: string | null; clientName?: string | null },
  clients: readonly MatchableClient[],
): ClientMatch | null {
  const rut = normalizeRut(document.clientRut);
  if (rut.length >= 8) {
    const byRut = clients.filter((client) => normalizeRut(client.identifier) === rut);
    if (byRut.length === 1) return { clientId: byRut[0].id, by: "rut" };
  }

  const name = normalizeName(document.clientName);
  if (name.length < 3) return null;
  let best: { client: MatchableClient; score: number } | null = null;
  let tie = false;
  for (const client of clients) {
    const score = nameScore(name, normalizeName(client.name));
    if (score < NAME_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = { client, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  // Two clients equally similar: better to leave it for a person than to pick the wrong one
  if (!best || tie) return null;
  return { clientId: best.client.id, by: "nombre" };
}
