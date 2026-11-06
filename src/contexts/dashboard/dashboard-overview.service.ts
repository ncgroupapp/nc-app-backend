import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { certificateStatus, CertificateStatus, todayInUruguay } from "../certificates/certificate-status";
import { LicitationStatus } from "../licitations/entities/licitation.entity";
import { ProfitabilityService } from "../profitability/profitability.service";
import { SolicitudStatus } from "../solicitudes/entities/solicitud.entity";

const TIME_ZONE = "America/Montevideo";
const NOW_UY = `(now() AT TIME ZONE '${TIME_ZONE}')`;
const ADJUDICATED = [LicitationStatus.PARTIAL_ADJUDICATION, LicitationStatus.TOTAL_ADJUDICATION];
const OPEN = [LicitationStatus.PENDING, LicitationStatus.QUOTED];

/** Net billing (invoices minus credit notes) of one period, per currency */
export interface MoneyByCurrency {
  UYU: number;
  USD: number;
}

export interface BillingMonth extends MoneyByCurrency {
  /** YYYY-MM */
  month: string;
}

export interface DashboardOverview {
  /** YYYY-MM-DD in Uruguay */
  today: string;
  billing: {
    thisMonth: MoneyByCurrency & { invoices: number; creditNotes: number };
    lastMonth: MoneyByCurrency;
    /** Last 12 months, oldest first, including the current one */
    monthly: BillingMonth[];
    yearToDate: MoneyByCurrency;
    creditNotesYear: MoneyByCurrency;
    topClients: Array<{ name: string; UYU: number; USD: number; documents: number }>;
    latest: Array<{
      id: number;
      type: string;
      series: string | null;
      number: string | null;
      issueDate: string | null;
      clientName: string | null;
      currency: string | null;
      total: number | null;
    }>;
  };
  licitations: {
    active: number;
    closingToday: number;
    closingThisWeek: number;
    /** Created per month, last 10 months, oldest first */
    createdMonthly: number[];
    /** Adjudicated / decided (adjudicated + not adjudicated), last 90 days and the 90 before */
    adjudicationRate: number | null;
    adjudicationRatePrevious: number | null;
    funnel: { received: number; quoted: number; adjudicated: number; delivered: number };
  };
  margin: { last90Days: number | null; minMargin: number };
  solicitudes: {
    new: number;
    unread: number;
    inProgress: number;
    resolvedThisMonth: number;
    /** Average minutes until the first reply sent from the app's mailbox, last 30 days */
    avgResponseMinutes: number | null;
    lastReceivedAt: string | null;
    latest: Array<{
      id: number;
      subject: string | null;
      fromName: string | null;
      fromEmail: string | null;
      receivedAt: string;
      status: SolicitudStatus;
      unread: boolean;
      assignee: string | null;
      attachments: number;
    }>;
  };
  certificates: Array<{ id: number; name: string; status: CertificateStatus; daysLeft: number | null }>;
  /** Products of open licitations that no supplier has quoted yet */
  missingOffers: { products: number; licitations: number; nextDeadline: string | null };
  /** Finished quotations (with VAT) of licitations still waiting to be adjudicated */
  atStake: MoneyByCurrency & { quotations: number };
  /** Open licitations closing in the next 7 days, soonest first */
  agenda: AgendaItem[];
  /** Invoices not marked as collected, by when they fall due (60 business days after the invoice date) */
  collections: Record<"overdue" | "thisWeek" | "restOfMonth" | "nextMonth", MoneyByCurrency & { invoices: number }>;
}

export interface AgendaItem {
  id: number;
  callNumber: string;
  clientName: string | null;
  /** YYYY-MM-DD and HH:MM in Uruguay */
  deadlineDay: string;
  deadlineTime: string;
  /** ready: quotation finished and every product has an offer */
  state: "ready" | "missing_offers" | "unfinished" | "no_quotation";
  missingOffers: number;
}

/** Business days (Monday to Friday) until an invoice falls due */
const PAYMENT_TERM_BUSINESS_DAYS = 60;

const money = (rows: Array<{ currency: string | null; net: string }>): MoneyByCurrency => ({
  UYU: Number(rows.find((r) => r.currency === "UYU")?.net ?? 0),
  USD: Number(rows.find((r) => r.currency === "USD")?.net ?? 0),
});

/** Signed amount: credit notes subtract */
const NET = `CASE WHEN type = 'nota_credito' THEN -ABS(COALESCE(total, 0)) ELSE COALESCE(total, 0) END`;
const NET_D = NET.replace(/\b(type|total)\b/g, 'd.$1');

@Injectable()
export class DashboardOverviewService {
  private readonly logger = new Logger(DashboardOverviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly profitabilityService: ProfitabilityService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const today = todayInUruguay();
    const [billing, licitations, margin, solicitudes, certificates, missingOffers, atStake, agenda, collections] = await Promise.all([
      this.safe("billing", () => this.billing(today), EMPTY_BILLING),
      this.safe("licitations", () => this.licitations(), EMPTY_LICITATIONS),
      this.safe("margin", () => this.margin(today), { last90Days: null, minMargin: 0 }),
      this.safe("solicitudes", () => this.solicitudes(), EMPTY_SOLICITUDES),
      this.safe("certificates", () => this.certificates(today), []),
      this.safe("missingOffers", () => this.missingOffers(), { products: 0, licitations: 0, nextDeadline: null }),
      this.safe("atStake", () => this.atStake(), { UYU: 0, USD: 0, quotations: 0 }),
      this.safe("agenda", () => this.agenda(), []),
      this.safe("collections", () => this.collections(today), EMPTY_COLLECTIONS),
    ]);
    return { today, billing, licitations, margin, solicitudes, certificates, missingOffers, atStake, agenda, collections };
  }

  private async missingOffers(): Promise<DashboardOverview["missingOffers"]> {
    const [row] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT lp."productId")::int AS products, COUNT(DISTINCT lp."licitationId")::int AS licitations,
              to_char(MIN(l."deadlineDate") FILTER (WHERE l."deadlineDate" >= ${NOW_UY}), 'YYYY-MM-DD HH24:MI') AS "nextDeadline"
         FROM licitation_products lp
         JOIN licitations l ON l.id = lp."licitationId"
        WHERE l.status = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM offers o WHERE o."productId" = lp."productId")`,
      [OPEN],
    );
    return { products: row.products, licitations: row.licitations, nextDeadline: row.nextDeadline };
  }

  private async atStake(): Promise<DashboardOverview["atStake"]> {
    const rows: Array<{ currency: string; total: string; quotations: number }> = await this.dataSource.query(
      `SELECT qi.currency, SUM(qi."priceWithIVA" * qi.quantity) AS total, COUNT(DISTINCT q.id)::int AS quotations
         FROM quotations q
         JOIN licitations l ON l.id = q."licitationId"
         JOIN quotation_items qi ON qi."quotationId" = q.id
        WHERE q.status = 'finalizada' AND l.status = $1
        GROUP BY qi.currency`,
      [LicitationStatus.QUOTED],
    );
    const [count] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS n FROM quotations q JOIN licitations l ON l.id = q."licitationId"
        WHERE q.status = 'finalizada' AND l.status = $1`,
      [LicitationStatus.QUOTED],
    );
    return {
      UYU: Math.round(Number(rows.find((r) => r.currency === "UYU")?.total ?? 0)),
      USD: Math.round(Number(rows.find((r) => r.currency === "USD")?.total ?? 0)),
      quotations: count.n,
    };
  }

  private async agenda(): Promise<AgendaItem[]> {
    const rows: Array<Omit<AgendaItem, "state"> & { quotationStatus: string | null }> = await this.dataSource.query(
      `SELECT l.id, l."callNumber", c.name AS "clientName",
              to_char(l."deadlineDate", 'YYYY-MM-DD') AS "deadlineDay", to_char(l."deadlineDate", 'HH24:MI') AS "deadlineTime",
              (SELECT q.status FROM quotations q WHERE q."licitationId" = l.id ORDER BY q."createdAt" DESC LIMIT 1) AS "quotationStatus",
              (SELECT COUNT(*)::int FROM licitation_products lp WHERE lp."licitationId" = l.id
                  AND NOT EXISTS (SELECT 1 FROM offers o WHERE o."productId" = lp."productId")) AS "missingOffers"
         FROM licitations l
         LEFT JOIN clients c ON c.id = l."clientId"
        WHERE l.status = ANY($1) AND l."deadlineDate" >= ${NOW_UY} AND l."deadlineDate" < ${NOW_UY}::date + 7
        ORDER BY l."deadlineDate"`,
      [OPEN],
    );
    return rows.map(({ quotationStatus, ...item }) => ({
      ...item,
      state: item.missingOffers > 0
        ? "missing_offers"
        : quotationStatus === "finalizada"
          ? "ready"
          : quotationStatus
            ? "unfinished"
            : "no_quotation",
    }));
  }

  private async collections(today: string): Promise<DashboardOverview["collections"]> {
    // The due date is the 60th weekday after the invoice date
    const rows: Array<{ bucket: keyof DashboardOverview["collections"]; currency: string | null; total: string; invoices: number }> =
      await this.dataSource.query(
        `WITH due AS (
           SELECT d.currency, d.total,
                  (SELECT day::date FROM generate_series(d."issueDate" + 1, d."issueDate" + $2::int * 2 + 14, interval '1 day') day
                    WHERE EXTRACT(ISODOW FROM day) < 6 ORDER BY day OFFSET $2::int - 1 LIMIT 1) AS "dueDate"
             FROM billing_documents d
            WHERE d.type = 'factura' AND d."paidAt" IS NULL AND d."issueDate" IS NOT NULL
         )
         SELECT CASE
                  WHEN "dueDate" < $1::date THEN 'overdue'
                  WHEN "dueDate" <= $1::date + 7 THEN 'thisWeek'
                  WHEN "dueDate" < date_trunc('month', $1::date) + interval '1 month' THEN 'restOfMonth'
                  WHEN "dueDate" < date_trunc('month', $1::date) + interval '2 months' THEN 'nextMonth'
                END AS bucket,
                currency, SUM(COALESCE(total, 0)) AS total, COUNT(*)::int AS invoices
           FROM due GROUP BY 1, 2`,
        [today, PAYMENT_TERM_BUSINESS_DAYS],
      );
    const result = structuredClone(EMPTY_COLLECTIONS);
    for (const row of rows) {
      if (!row.bucket) continue;
      const bucket = result[row.bucket];
      if (row.currency === "UYU" || row.currency === "USD") bucket[row.currency] += Math.round(Number(row.total));
      bucket.invoices += row.invoices;
    }
    return result;
  }

  /** One section failing (e.g. a table not created yet) must not break the whole dashboard */
  private async safe<T>(section: string, load: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await load();
    } catch (error) {
      this.logger.error(`Could not load ${section}`, error instanceof Error ? error.stack : String(error));
      return fallback;
    }
  }

  private async billing(today: string): Promise<DashboardOverview["billing"]> {
    const month = `date_trunc('month', $1::date)`;
    const [thisMonth, counts, lastMonth, monthly, year, creditYear, top, latest] = await Promise.all([
      this.dataSource.query(
        `SELECT currency, SUM(${NET}) AS net FROM billing_documents
          WHERE "issueDate" >= ${month} AND "issueDate" <= $1::date GROUP BY currency`,
        [today],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FILTER (WHERE type = 'factura')::int AS invoices,
                COUNT(*) FILTER (WHERE type = 'nota_credito')::int AS "creditNotes"
           FROM billing_documents WHERE "issueDate" >= ${month} AND "issueDate" <= $1::date`,
        [today],
      ),
      this.dataSource.query(
        `SELECT currency, SUM(${NET}) AS net FROM billing_documents
          WHERE "issueDate" >= ${month} - interval '1 month' AND "issueDate" < ${month} GROUP BY currency`,
        [today],
      ),
      this.dataSource.query(
        `SELECT to_char(m, 'YYYY-MM') AS month,
                COALESCE(SUM(${NET}) FILTER (WHERE currency = 'UYU'), 0) AS "UYU",
                COALESCE(SUM(${NET}) FILTER (WHERE currency = 'USD'), 0) AS "USD"
           FROM generate_series(${month} - interval '11 months', ${month}, interval '1 month') m
           LEFT JOIN billing_documents d ON date_trunc('month', d."issueDate") = m
          GROUP BY m ORDER BY m`,
        [today],
      ),
      this.dataSource.query(
        `SELECT currency, SUM(${NET}) AS net FROM billing_documents
          WHERE "issueDate" >= date_trunc('year', $1::date) AND "issueDate" <= $1::date GROUP BY currency`,
        [today],
      ),
      this.dataSource.query(
        `SELECT currency, SUM(ABS(COALESCE(total, 0))) AS net FROM billing_documents
          WHERE type = 'nota_credito' AND "issueDate" >= date_trunc('year', $1::date) AND "issueDate" <= $1::date
          GROUP BY currency`,
        [today],
      ),
      this.dataSource.query(
        // Documents linked to a client of the app are grouped under that client's name
        `SELECT COALESCE(c.name, d."clientName") AS name,
                COALESCE(SUM(${NET_D}) FILTER (WHERE d.currency = 'UYU'), 0) AS "UYU",
                COALESCE(SUM(${NET_D}) FILTER (WHERE d.currency = 'USD'), 0) AS "USD",
                COUNT(*)::int AS documents
           FROM billing_documents d
           LEFT JOIN clients c ON c.id = d."clientId"
          WHERE COALESCE(c.name, d."clientName") IS NOT NULL AND d."issueDate" >= date_trunc('year', $1::date)
          GROUP BY COALESCE(c.name, d."clientName")
          ORDER BY 2 DESC, 3 DESC LIMIT 5`,
        [today],
      ),
      this.dataSource.query(
        `SELECT d.id, d.type, d.series, d.number, to_char(d."issueDate", 'YYYY-MM-DD') AS "issueDate",
                COALESCE(c.name, d."clientName") AS "clientName", d.currency, d.total
           FROM billing_documents d LEFT JOIN clients c ON c.id = d."clientId"
          ORDER BY d."issueDate" DESC NULLS LAST, d.id DESC LIMIT 5`,
      ),
    ]);
    return {
      thisMonth: { ...money(thisMonth), invoices: counts[0]?.invoices ?? 0, creditNotes: counts[0]?.creditNotes ?? 0 },
      lastMonth: money(lastMonth),
      monthly: monthly.map((m: Record<string, string>) => ({ month: m.month, UYU: Number(m.UYU), USD: Number(m.USD) })),
      yearToDate: money(year),
      creditNotesYear: money(creditYear),
      topClients: top.map((c: Record<string, string | number>) => ({
        name: String(c.name),
        UYU: Number(c.UYU),
        USD: Number(c.USD),
        documents: Number(c.documents),
      })),
      latest: latest.map((d: Record<string, unknown>) => ({ ...d, total: d.total === null ? null : Number(d.total) })),
    };
  }

  private async licitations(): Promise<DashboardOverview["licitations"]> {
    const [[counts], created, [rates], [funnel]] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::int AS active,
                COUNT(*) FILTER (WHERE "deadlineDate"::date = ${NOW_UY}::date)::int AS "closingToday",
                COUNT(*) FILTER (WHERE "deadlineDate" >= ${NOW_UY} AND "deadlineDate" < ${NOW_UY}::date + 7)::int AS "closingThisWeek"
           FROM licitations WHERE status = ANY($1)`,
        [OPEN],
      ),
      this.dataSource.query(
        `SELECT COUNT(l.id)::int AS n
           FROM generate_series(date_trunc('month', ${NOW_UY}) - interval '9 months', date_trunc('month', ${NOW_UY}), interval '1 month') m
           LEFT JOIN licitations l ON date_trunc('month', l."createdAt") = m
          GROUP BY m ORDER BY m`,
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FILTER (WHERE status = ANY($1) AND "updatedAt" >= now() - interval '90 days')::int AS won,
                COUNT(*) FILTER (WHERE status = $2 AND "updatedAt" >= now() - interval '90 days')::int AS lost,
                COUNT(*) FILTER (WHERE status = ANY($1) AND "updatedAt" < now() - interval '90 days' AND "updatedAt" >= now() - interval '180 days')::int AS "wonBefore",
                COUNT(*) FILTER (WHERE status = $2 AND "updatedAt" < now() - interval '90 days' AND "updatedAt" >= now() - interval '180 days')::int AS "lostBefore"
           FROM licitations`,
        [ADJUDICATED, LicitationStatus.NOT_ADJUDICATED],
      ),
      this.dataSource.query(
        `WITH recent AS (SELECT id, status FROM licitations WHERE "createdAt" >= now() - interval '90 days')
         SELECT COUNT(*)::int AS received,
                COUNT(*) FILTER (WHERE status <> $1
                  OR EXISTS (SELECT 1 FROM quotations q WHERE q."licitationId" = recent.id AND q.status = 'finalizada'))::int AS quoted,
                COUNT(*) FILTER (WHERE status = ANY($2)
                  OR EXISTS (SELECT 1 FROM adjudications a WHERE a."licitationId" = recent.id))::int AS adjudicated,
                COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM deliveries d WHERE d."licitationId" = recent.id
                     AND EXISTS (SELECT 1 FROM delivery_items i WHERE i."deliveryId" = d.id)
                     AND NOT EXISTS (SELECT 1 FROM delivery_items i WHERE i."deliveryId" = d.id AND i.status <> 'entregado')))::int AS delivered
           FROM recent`,
        [LicitationStatus.PENDING, ADJUDICATED],
      ),
    ]);
    const rate = (won: number, lost: number) => (won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : null);
    return {
      active: counts.active,
      closingToday: counts.closingToday,
      closingThisWeek: counts.closingThisWeek,
      createdMonthly: created.map((row: { n: number }) => row.n),
      adjudicationRate: rate(rates.won, rates.lost),
      adjudicationRatePrevious: rate(rates.wonBefore, rates.lostBefore),
      funnel,
    };
  }

  private async margin(today: string): Promise<DashboardOverview["margin"]> {
    const from = new Date(`${today}T00:00:00Z`);
    from.setUTCDate(from.getUTCDate() - 90);
    const report = await this.profitabilityService.getReport({ dateFrom: from.toISOString().slice(0, 10) });
    return { last90Days: report.summary.margin, minMargin: report.settings.minMargin };
  }

  private async solicitudes(): Promise<DashboardOverview["solicitudes"]> {
    const [[counts], [response], latest] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) FILTER (WHERE status = $1)::int AS new,
                COUNT(*) FILTER (WHERE unread AND status <> $4)::int AS unread,
                COUNT(*) FILTER (WHERE status = $2)::int AS "inProgress",
                COUNT(*) FILTER (WHERE status = $3 AND "updatedAt" >= date_trunc('month', now()))::int AS "resolvedThisMonth",
                MAX("receivedAt") AS "lastReceivedAt"
           FROM solicitudes`,
        [SolicitudStatus.NEW, SolicitudStatus.IN_PROGRESS, SolicitudStatus.RESOLVED, SolicitudStatus.CANCELLED],
      ),
      this.dataSource.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (reply."sentAt" - s."receivedAt")) / 60) AS minutes
           FROM solicitudes s
           JOIN LATERAL (
             SELECT MIN(m."sentAt") AS "sentAt" FROM solicitud_messages m
              WHERE m."solicitudId" = s.id AND m.outgoing AND m."sentAt" > s."receivedAt"
           ) reply ON reply."sentAt" IS NOT NULL
          WHERE s."receivedAt" >= now() - interval '30 days'`,
      ),
      this.dataSource.query(
        `SELECT s.id, s.subject, s."fromName", s."fromEmail", s."receivedAt", s.status, s.unread, s.assignee,
                (SELECT COUNT(*)::int FROM solicitud_attachments a
                   JOIN solicitud_messages m ON m.id = a."messageId" WHERE m."solicitudId" = s.id) AS attachments
           FROM solicitudes s
          WHERE s.status IN ($1, $2)
          ORDER BY (s.status = $1) DESC, s.unread DESC, s."receivedAt" DESC
          LIMIT 4`,
        [SolicitudStatus.NEW, SolicitudStatus.IN_PROGRESS],
      ),
    ]);
    return {
      new: counts.new,
      unread: counts.unread,
      inProgress: counts.inProgress,
      resolvedThisMonth: counts.resolvedThisMonth,
      avgResponseMinutes: response?.minutes === null || response?.minutes === undefined ? null : Math.round(Number(response.minutes)),
      lastReceivedAt: counts.lastReceivedAt ? new Date(counts.lastReceivedAt).toISOString() : null,
      latest: latest.map((s: Record<string, unknown>) => ({ ...s, receivedAt: new Date(s.receivedAt as string).toISOString() })),
    };
  }

  private async certificates(today: string): Promise<DashboardOverview["certificates"]> {
    const rows: Array<{ id: number; name: string; expiryDate: string | null; alertDays: number }> = await this.dataSource.query(
      `SELECT id, name, to_char("expiryDate", 'YYYY-MM-DD') AS "expiryDate", "alertDays"
         FROM certificates WHERE "requiredForRupe" ORDER BY id`,
    );
    return rows.map((row) => ({ id: row.id, name: row.name, ...certificateStatus(row.expiryDate, row.alertDays, today) }));
  }
}

const EMPTY_BILLING: DashboardOverview["billing"] = {
  thisMonth: { UYU: 0, USD: 0, invoices: 0, creditNotes: 0 },
  lastMonth: { UYU: 0, USD: 0 },
  monthly: [],
  yearToDate: { UYU: 0, USD: 0 },
  creditNotesYear: { UYU: 0, USD: 0 },
  topClients: [],
  latest: [],
};

const EMPTY_LICITATIONS: DashboardOverview["licitations"] = {
  active: 0,
  closingToday: 0,
  closingThisWeek: 0,
  createdMonthly: [],
  adjudicationRate: null,
  adjudicationRatePrevious: null,
  funnel: { received: 0, quoted: 0, adjudicated: 0, delivered: 0 },
};

const EMPTY_COLLECTIONS: DashboardOverview["collections"] = {
  overdue: { UYU: 0, USD: 0, invoices: 0 },
  thisWeek: { UYU: 0, USD: 0, invoices: 0 },
  restOfMonth: { UYU: 0, USD: 0, invoices: 0 },
  nextMonth: { UYU: 0, USD: 0, invoices: 0 },
};

const EMPTY_SOLICITUDES: DashboardOverview["solicitudes"] = {
  new: 0,
  unread: 0,
  inProgress: 0,
  resolvedThisMonth: 0,
  avgResponseMinutes: null,
  lastReceivedAt: null,
  latest: [],
};
