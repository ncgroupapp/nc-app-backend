import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { LicitationStatus } from "../licitations/entities/licitation.entity";
import { FilterProfitabilityDto, ProfitabilityStatus } from "./dto/filter-profitability.dto";
import { UpdateProfitabilitySettingsDto } from "./dto/update-profitability-settings.dto";

const DEFAULT_MIN_MARGIN = 5;

/** Single-row settings table; created on startup because migrations are not run on deploy. */
const CREATE_SETTINGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "profitability_settings" (
    "id" integer PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
    "exchangeRate" numeric(12,4),
    "minMargin" numeric(5,2) NOT NULL DEFAULT ${DEFAULT_MIN_MARGIN},
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  );
`;

const STATUS_GROUPS: Record<ProfitabilityStatus, LicitationStatus[]> = {
  abierta: [LicitationStatus.PENDING],
  presentada: [LicitationStatus.QUOTED],
  adjudicada: [LicitationStatus.TOTAL_ADJUDICATION, LicitationStatus.PARTIAL_ADJUDICATION],
  perdida: [LicitationStatus.NOT_ADJUDICATED],
  cerrada: [LicitationStatus.CLOSED],
};

export interface ProfitabilitySettings {
  /** Pesos uruguayos por 1 dólar; null until the user sets it. */
  exchangeRate: number | null;
  minMargin: number;
  updatedAt: Date | null;
}

/** ok: has an offer and both amounts convert to USD. */
export type ProfitabilityItemState = "ok" | "sin_oferta" | "sin_conversion";

export interface ProfitabilityItem {
  id: number;
  productId: number | null;
  productName: string;
  productCode: string | null;
  quantity: number;
  offerId: number | null;
  providerName: string | null;
  offerDate: Date | null;
  unitCost: number | null;
  costCurrency: string | null;
  unitCostUsd: number | null;
  unitSale: number;
  saleCurrency: string;
  unitSaleUsd: number | null;
  saleUsd: number | null;
  costUsd: number | null;
  profitUsd: number | null;
  margin: number | null;
  markup: number | null;
  state: ProfitabilityItemState;
}

export interface ProfitabilityTotals {
  /** Everything offered (items that convert to USD), with or without a chosen offer. */
  offeredUsd: number;
  /** Sale and cost of the items that have an offer: margin and markup use only these. */
  costedSaleUsd: number;
  costUsd: number;
  profitUsd: number;
  margin: number | null;
  markup: number | null;
}

export interface ProfitabilityLicitation extends ProfitabilityTotals {
  id: number;
  callNumber: string;
  internalNumber: string | null;
  clientId: number;
  clientName: string;
  startDate: string;
  deadlineDate: string;
  status: ProfitabilityStatus;
  quotationId: number | null;
  quotationIdentifier: string | null;
  itemsWithoutOffer: number;
  itemsWithoutConversion: number;
  belowMinMargin: boolean;
  items: ProfitabilityItem[];
}

export interface ProfitabilityReport {
  settings: ProfitabilitySettings;
  summary: ProfitabilityTotals & {
    licitations: number;
    itemsWithoutOffer: number;
    itemsWithoutConversion: number;
    belowMinMargin: number;
  };
  licitations: ProfitabilityLicitation[];
}

interface LicitationRow {
  id: number;
  callNumber: string;
  internalNumber: string | null;
  clientId: number;
  clientName: string;
  startDate: Date;
  deadlineDate: Date;
  status: LicitationStatus;
  quotationId: number | null;
  quotationIdentifier: string | null;
}

interface ItemRow {
  id: number;
  quotationId: number;
  productId: number | null;
  productName: string;
  productCode: string | null;
  quantity: string;
  offerId: number | null;
  providerName: string | null;
  offerDate: Date | null;
  unitCost: string | null;
  costCurrency: string | null;
  priceWithoutIVA: string;
  currency: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);

/**
 * Read-only profitability report: sale = quotation item price, cost = the supplier offer
 * chosen on that item. Amounts are converted to USD with the fixed rate from settings.
 */
@Injectable()
export class ProfitabilityService implements OnModuleInit {
  private readonly logger = new Logger(ProfitabilityService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_SETTINGS_TABLE_SQL);
    } catch (error) {
      this.logger.error("Could not ensure profitability_settings table", error instanceof Error ? error.stack : String(error));
    }
  }

  async getSettings(): Promise<ProfitabilitySettings> {
    const rows: Array<{ exchangeRate: string | null; minMargin: string; updatedAt: Date }> = await this.dataSource.query(
      `SELECT "exchangeRate", "minMargin", "updatedAt" FROM "profitability_settings" WHERE "id" = 1`,
    );
    const row = rows[0];
    if (!row) return { exchangeRate: null, minMargin: DEFAULT_MIN_MARGIN, updatedAt: null };
    return {
      exchangeRate: row.exchangeRate === null ? null : Number(row.exchangeRate),
      minMargin: Number(row.minMargin),
      updatedAt: row.updatedAt,
    };
  }

  async updateSettings(dto: UpdateProfitabilitySettingsDto): Promise<ProfitabilitySettings> {
    await this.dataSource.query(
      `INSERT INTO "profitability_settings" ("id", "exchangeRate", "minMargin", "updatedAt")
       VALUES (1, $1, $2, now())
       ON CONFLICT ("id") DO UPDATE SET "exchangeRate" = EXCLUDED."exchangeRate", "minMargin" = EXCLUDED."minMargin", "updatedAt" = now()`,
      [dto.exchangeRate, dto.minMargin],
    );
    return this.getSettings();
  }

  async getReport(filters: FilterProfitabilityDto): Promise<ProfitabilityReport> {
    const settings = await this.getSettings();
    const licitationRows = await this.findLicitations(filters);
    const quotationIds = licitationRows.map((row) => row.quotationId).filter((id): id is number => id !== null);
    const itemRows = quotationIds.length ? await this.findItems(quotationIds) : [];

    const itemsByQuotation = new Map<number, ItemRow[]>();
    for (const row of itemRows) {
      const list = itemsByQuotation.get(row.quotationId) ?? [];
      list.push(row);
      itemsByQuotation.set(row.quotationId, list);
    }

    const licitations = licitationRows.map((row) => {
      const items = (row.quotationId ? itemsByQuotation.get(row.quotationId) ?? [] : []).map((item) =>
        this.toItem(item, settings.exchangeRate),
      );
      const totals = this.totals(items);
      return {
        id: row.id,
        callNumber: row.callNumber,
        internalNumber: row.internalNumber?.trim() || null,
        clientId: row.clientId,
        clientName: row.clientName,
        startDate: new Date(row.startDate).toISOString(),
        deadlineDate: new Date(row.deadlineDate).toISOString(),
        status: this.statusLabel(row.status),
        quotationId: row.quotationId,
        quotationIdentifier: row.quotationIdentifier,
        ...totals,
        itemsWithoutOffer: items.filter((item) => item.state === "sin_oferta").length,
        itemsWithoutConversion: items.filter((item) => item.state === "sin_conversion").length,
        belowMinMargin: totals.margin !== null && totals.margin < settings.minMargin,
        items,
      };
    });

    const allItems = licitations.flatMap((licitation) => licitation.items);
    return {
      settings,
      summary: {
        licitations: licitations.length,
        ...this.totals(allItems),
        itemsWithoutOffer: licitations.reduce((sum, l) => sum + l.itemsWithoutOffer, 0),
        itemsWithoutConversion: licitations.reduce((sum, l) => sum + l.itemsWithoutConversion, 0),
        belowMinMargin: licitations.filter((l) => l.belowMinMargin).length,
      },
      licitations,
    };
  }

  /** Licitations matching the filters, each with its most recent quotation. */
  private async findLicitations(filters: FilterProfitabilityDto): Promise<LicitationRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filters.dateFrom) where.push(`l."startDate" >= ${param(filters.dateFrom)}::date`);
    if (filters.dateTo) where.push(`l."startDate" < (${param(filters.dateTo)}::date + interval '1 day')`);
    if (filters.status) where.push(`l."status"::text = ANY(${param(STATUS_GROUPS[filters.status])})`);
    if (filters.clientId) where.push(`l."clientId" = ${param(filters.clientId)}`);
    if (filters.search?.trim()) {
      const p = param(`%${filters.search.trim()}%`);
      where.push(`(l."callNumber" ILIKE ${p} OR l."internalNumber" ILIKE ${p} OR c."name" ILIKE ${p})`);
    }
    if (filters.product?.trim()) {
      const p = param(`%${filters.product.trim()}%`);
      where.push(`EXISTS (
        SELECT 1 FROM "quotation_items" qi
        LEFT JOIN "products" pr ON pr."id" = qi."productId"
        WHERE qi."quotationId" = q."id" AND (qi."productName" ILIKE ${p} OR pr."code" ILIKE ${p})
      )`);
    }

    return this.dataSource.query(
      `SELECT l."id", l."callNumber", l."internalNumber", l."clientId", c."name" AS "clientName",
              l."startDate", l."deadlineDate", l."status", q."id" AS "quotationId", q."quotationIdentifier"
       FROM "licitations" l
       JOIN "clients" c ON c."id" = l."clientId"
       LEFT JOIN LATERAL (
         SELECT q."id", q."quotationIdentifier" FROM "quotations" q
         WHERE q."licitationId" = l."id" ORDER BY q."updatedAt" DESC, q."id" DESC LIMIT 1
       ) q ON true
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY l."startDate" DESC, l."id" DESC`,
      params,
    );
  }

  private findItems(quotationIds: number[]): Promise<ItemRow[]> {
    return this.dataSource.query(
      `SELECT qi."id", qi."quotationId", qi."productId", qi."productName", pr."code" AS "productCode",
              qi."quantity", qi."offerId", COALESCE(pv."name", qi."providerName") AS "providerName",
              o."createdAt" AS "offerDate", qi."unitCost", qi."costCurrency", qi."priceWithoutIVA", qi."currency"
       FROM "quotation_items" qi
       LEFT JOIN "products" pr ON pr."id" = qi."productId"
       LEFT JOIN "offers" o ON o."id" = qi."offerId"
       LEFT JOIN "providers" pv ON pv."id" = o."providerId"
       WHERE qi."quotationId" = ANY($1)
       ORDER BY qi."id"`,
      [quotationIds],
    );
  }

  private toItem(row: ItemRow, exchangeRate: number | null): ProfitabilityItem {
    const quantity = Number(row.quantity);
    const unitSale = Number(row.priceWithoutIVA);
    const unitCost = row.unitCost === null ? null : Number(row.unitCost);
    const unitSaleUsd = this.toUsd(unitSale, row.currency, exchangeRate);
    const unitCostUsd = unitCost === null ? null : this.toUsd(unitCost, row.costCurrency, exchangeRate);

    const hasOffer = unitCost !== null;
    const state: ProfitabilityItemState = !hasOffer
      ? "sin_oferta"
      : unitSaleUsd === null || unitCostUsd === null
        ? "sin_conversion"
        : "ok";

    const saleUsd = unitSaleUsd === null ? null : round2(unitSaleUsd * quantity);
    const costUsd = state === "ok" ? round2(unitCostUsd! * quantity) : null;
    const profitUsd = state === "ok" ? round2(saleUsd! - costUsd!) : null;

    return {
      id: row.id,
      productId: row.productId,
      productName: row.productName,
      productCode: row.productCode,
      quantity,
      offerId: row.offerId,
      providerName: hasOffer ? row.providerName : null,
      offerDate: row.offerDate,
      unitCost,
      costCurrency: row.costCurrency,
      unitCostUsd: unitCostUsd === null ? null : round2(unitCostUsd),
      unitSale,
      saleCurrency: row.currency,
      unitSaleUsd: unitSaleUsd === null ? null : round2(unitSaleUsd),
      saleUsd,
      costUsd,
      profitUsd,
      margin: profitUsd === null ? null : percent(profitUsd, saleUsd!),
      markup: profitUsd === null ? null : percent(profitUsd, costUsd!),
      state,
    };
  }

  private totals(items: ProfitabilityItem[]): ProfitabilityTotals {
    const costed = items.filter((item) => item.state === "ok");
    const offeredUsd = round2(items.reduce((sum, item) => sum + (item.saleUsd ?? 0), 0));
    const costedSaleUsd = round2(costed.reduce((sum, item) => sum + item.saleUsd!, 0));
    const costUsd = round2(costed.reduce((sum, item) => sum + item.costUsd!, 0));
    const profitUsd = round2(costedSaleUsd - costUsd);
    return {
      offeredUsd,
      costedSaleUsd,
      costUsd,
      profitUsd,
      margin: costed.length ? percent(profitUsd, costedSaleUsd) : null,
      markup: costed.length ? percent(profitUsd, costUsd) : null,
    };
  }

  /** Only USD and UYU (with the fixed rate) convert; other currencies are flagged. */
  private toUsd(amount: number, currency: string | null, exchangeRate: number | null): number | null {
    if (currency === "USD") return amount;
    if (currency === "UYU" && exchangeRate) return amount / exchangeRate;
    return null;
  }

  private statusLabel(status: LicitationStatus): ProfitabilityStatus {
    const entry = (Object.entries(STATUS_GROUPS) as Array<[ProfitabilityStatus, LicitationStatus[]]>).find(([, values]) =>
      values.includes(status),
    );
    return entry ? entry[0] : "abierta";
  }
}
