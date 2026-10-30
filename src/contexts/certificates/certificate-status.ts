export type CertificateStatus = "vigente" | "por_vencer" | "vencido" | "sin_cargar";

const TIME_ZONE = "America/Montevideo";

/** Today as YYYY-MM-DD in Uruguay */
export const todayInUruguay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** Whole days from today until the expiry date (negative once expired), both YYYY-MM-DD */
export const daysUntil = (expiryDate: string, today: string) =>
  Math.round((Date.parse(`${expiryDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

/** A certificate is valid through its expiry date and turns "por_vencer" alertDays before it */
export function certificateStatus(
  expiryDate: string | null,
  alertDays: number,
  today: string,
): { status: CertificateStatus; daysLeft: number | null } {
  if (!expiryDate) return { status: "sin_cargar", daysLeft: null };
  const daysLeft = daysUntil(expiryDate, today);
  if (daysLeft < 0) return { status: "vencido", daysLeft };
  if (daysLeft <= alertDays) return { status: "por_vencer", daysLeft };
  return { status: "vigente", daysLeft };
}
