import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { LicitationStatus } from "../licitations/entities/licitation.entity";
import { QuotationStatus } from "../quotation/entities/quotation.entity";

/** Licitation deadlines are stored as Uruguay wall-clock time (timestamp without time zone). */
const TIME_ZONE = "America/Montevideo";
const NOW_UY = `(now() AT TIME ZONE '${TIME_ZONE}')`;

/** Licitations still being worked on; closed or adjudicated ones don't need alerts. */
const OPEN_STATUSES = [LicitationStatus.PENDING, LicitationStatus.QUOTED];

export interface MissingOfferProduct {
  productId: number;
  name: string;
  code: string | null;
  brand: string | null;
}

export interface ClosingLicitation {
  id: number;
  callNumber: string;
  internalNumber: string | null;
  status: LicitationStatus;
  clientName: string | null;
  /** HH:MM in Uruguay. */
  deadlineTime: string;
  /** Deadline already passed today. */
  closed: boolean;
  quotationId: number | null;
  quotationIdentifier: string | null;
  quotationStatus: QuotationStatus | null;
  /** Products of the call (or its quotation) with no supplier offer loaded yet. */
  missingOffers: MissingOfferProduct[];
}

export interface UnfinishedQuotation {
  id: number;
  quotationIdentifier: string;
  licitationId: number | null;
  callNumber: string | null;
  clientName: string | null;
  itemCount: number;
  /** YYYY-MM-DD and HH:MM in Uruguay. */
  deadlineDay: string | null;
  deadlineTime: string | null;
  /** The licitation deadline already passed. */
  overdue: boolean;
}

export interface DashboardAlerts {
  /** YYYY-MM-DD in Uruguay. */
  today: string;
  closingToday: ClosingLicitation[];
  unfinishedQuotations: UnfinishedQuotation[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getAlerts(): Promise<DashboardAlerts> {
    const [[{ today }], closing, unfinished] = await Promise.all([
      this.dataSource.query(`SELECT to_char(${NOW_UY}, 'YYYY-MM-DD') AS today`),
      this.dataSource.query(
        `SELECT l.id, l."callNumber", l."internalNumber", l.status, c.name AS "clientName",
                to_char(l."deadlineDate", 'HH24:MI') AS "deadlineTime",
                l."deadlineDate" < ${NOW_UY} AS closed,
                q.id AS "quotationId", q."quotationIdentifier", q.status AS "quotationStatus"
           FROM licitations l
           LEFT JOIN clients c ON c.id = l."clientId"
           LEFT JOIN LATERAL (
             SELECT id, "quotationIdentifier", status FROM quotations
              WHERE "licitationId" = l.id ORDER BY "createdAt" DESC LIMIT 1
           ) q ON true
          WHERE l."deadlineDate"::date = ${NOW_UY}::date
            AND l.status = ANY($1)
          ORDER BY l."deadlineDate"`,
        [OPEN_STATUSES],
      ),
      this.dataSource.query(
        `SELECT q.id, q."quotationIdentifier", q."licitationId", l."callNumber",
                COALESCE(c.name, q."clientName") AS "clientName",
                (SELECT count(*)::int FROM quotation_items qi WHERE qi."quotationId" = q.id) AS "itemCount",
                to_char(l."deadlineDate", 'YYYY-MM-DD') AS "deadlineDay",
                to_char(l."deadlineDate", 'HH24:MI') AS "deadlineTime",
                COALESCE(l."deadlineDate" < ${NOW_UY}, false) AS overdue
           FROM quotations q
           LEFT JOIN licitations l ON l.id = q."licitationId"
           LEFT JOIN clients c ON c.id = COALESCE(l."clientId", q."clientId")
          WHERE q.status = $1
          ORDER BY l."deadlineDate" ASC NULLS LAST, q."createdAt" DESC`,
        [QuotationStatus.CREATED],
      ),
    ]);

    const ids: number[] = closing.map((l: ClosingLicitation) => l.id);
    const missing = ids.length ? await this.findMissingOffers(ids) : [];

    return {
      today,
      closingToday: closing.map((l: Omit<ClosingLicitation, "missingOffers">) => ({
        ...l,
        missingOffers: missing
          .filter((m) => m.licitationId === l.id)
          .map(({ licitationId: _licitationId, ...product }) => product),
      })),
      unfinishedQuotations: unfinished,
    };
  }

  /** Products of the given licitations (listed in the call or in its quotations) that have no offer at all. */
  private async findMissingOffers(licitationIds: number[]): Promise<Array<MissingOfferProduct & { licitationId: number }>> {
    return this.dataSource.query(
      `WITH items AS (
         SELECT lp."licitationId", lp."productId" FROM licitation_products lp
          WHERE lp."licitationId" = ANY($1)
         UNION
         SELECT q."licitationId", qi."productId" FROM quotation_items qi
           JOIN quotations q ON q.id = qi."quotationId"
          WHERE q."licitationId" = ANY($1) AND qi."productId" IS NOT NULL
       )
       SELECT i."licitationId", p.id AS "productId", p.name, p.code, p.brand
         FROM items i
         JOIN products p ON p.id = i."productId"
        WHERE NOT EXISTS (SELECT 1 FROM offers o WHERE o."productId" = i."productId")
        ORDER BY i."licitationId", p.name`,
      [licitationIds],
    );
  }
}
