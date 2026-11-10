import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { FilterPurchaseOrdersDto, SavePurchaseOrderDto, UpdatePurchaseOrderDto } from "./dto/purchase-order.dto";
import { CREATE_PURCHASE_ORDERS_TABLES_SQL } from "./purchase-orders.table";

export const MAX_PURCHASE_ORDER_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_FILE = /\.(pdf|png|jpe?g|webp)$/i;

export interface PurchaseOrderView {
  id: number;
  number: string;
  /** YYYY-MM-DD */
  issueDate: string | null;
  clientId: number | null;
  clientName: string | null;
  licitationId: number | null;
  licitation: { id: number; callNumber: string; internalNumber: string | null } | null;
  currency: string | null;
  total: number | null;
  notes: string | null;
  fileName: string | null;
  fileSize: number | null;
  invoices: Array<{ id: number; type: string; series: string | null; number: string | null; issueDate: string | null; currency: string | null; total: number | null }>;
  remitos: Array<{ id: number; number: number; date: string; status: string }>;
  createdAt: string;
}

export interface PurchaseOrderMetrics {
  total: number;
  thisMonth: number;
  amounts: { UYU: number; USD: number };
  /** Orders with no invoice linked yet: delivered or not, they still have to be billed */
  withoutInvoice: number;
  withoutRemito: number;
  withoutFile: number;
}

const BASE_SELECT = `
  SELECT po.id, po.number, to_char(po."issueDate", 'YYYY-MM-DD') AS "issueDate", po."clientId", c.name AS "clientName",
         po."licitationId", po.currency, po.total::float AS total, po.notes, po."fileName", po."fileSize", po."createdAt",
         CASE WHEN l.id IS NULL THEN NULL
              ELSE json_build_object('id', l.id, 'callNumber', l."callNumber", 'internalNumber', l."internalNumber") END AS licitation,
         COALESCE((SELECT json_agg(json_build_object('id', d.id, 'type', d.type, 'series', d.series, 'number', d.number,
                     'issueDate', to_char(d."issueDate", 'YYYY-MM-DD'), 'currency', d.currency, 'total', d.total::float) ORDER BY d."issueDate", d.id)
                     FROM purchase_order_invoices pi JOIN billing_documents d ON d.id = pi."billingDocumentId"
                    WHERE pi."purchaseOrderId" = po.id), '[]') AS invoices,
         COALESCE((SELECT json_agg(json_build_object('id', r.id, 'number', r.number, 'date', to_char(r.date, 'YYYY-MM-DD'), 'status', r.status) ORDER BY r.number)
                     FROM purchase_order_remitos pr JOIN remitos r ON r.id = pr."remitoId"
                    WHERE pr."purchaseOrderId" = po.id), '[]') AS remitos
    FROM purchase_orders po
    LEFT JOIN clients c ON c.id = po."clientId"
    LEFT JOIN licitations l ON l.id = po."licitationId"`;

@Injectable()
export class PurchaseOrdersService implements OnModuleInit {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_PURCHASE_ORDERS_TABLES_SQL);
    } catch (error) {
      this.logger.error("Could not ensure purchase orders tables", error instanceof Error ? error.stack : String(error));
    }
  }

  async findAll(filters: FilterPurchaseOrdersDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 200);
    const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
    const where = `WHERE ($1::text IS NULL OR po.number ILIKE $1 OR c.name ILIKE $1 OR l."callNumber" ILIKE $1 OR l."internalNumber" ILIKE $1)`;
    const [data, [{ count }]] = await Promise.all([
      this.dataSource.query(
        `${BASE_SELECT} ${where} ORDER BY po."issueDate" DESC NULLS LAST, po.id DESC LIMIT $2 OFFSET $3`,
        [search, limit, (page - 1) * limit],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM purchase_orders po
           LEFT JOIN clients c ON c.id = po."clientId" LEFT JOIN licitations l ON l.id = po."licitationId" ${where}`,
        [search],
      ),
    ]);
    return { data, meta: { total: count, page, limit, lastPage: Math.max(1, Math.ceil(count / limit)) } };
  }

  async metrics(): Promise<PurchaseOrderMetrics> {
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE "issueDate" >= date_trunc('month', (now() AT TIME ZONE 'America/Montevideo')::date))::int AS "thisMonth",
              COALESCE(SUM(total) FILTER (WHERE currency = 'UYU'), 0)::float AS "UYU",
              COALESCE(SUM(total) FILTER (WHERE currency = 'USD'), 0)::float AS "USD",
              COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM purchase_order_invoices pi WHERE pi."purchaseOrderId" = po.id))::int AS "withoutInvoice",
              COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM purchase_order_remitos pr WHERE pr."purchaseOrderId" = po.id))::int AS "withoutRemito",
              COUNT(*) FILTER (WHERE po."fileData" IS NULL)::int AS "withoutFile"
         FROM purchase_orders po`,
    );
    return {
      total: row.total,
      thisMonth: row.thisMonth,
      amounts: { UYU: row.UYU, USD: row.USD },
      withoutInvoice: row.withoutInvoice,
      withoutRemito: row.withoutRemito,
      withoutFile: row.withoutFile,
    };
  }

  async findOne(id: number): Promise<PurchaseOrderView> {
    const [order] = await this.dataSource.query(`${BASE_SELECT} WHERE po.id = $1`, [id]);
    if (!order) throw new NotFoundException(`Orden de compra ${id} no encontrada`);
    return order;
  }

  async create(dto: SavePurchaseOrderDto): Promise<PurchaseOrderView> {
    const id = await this.dataSource.transaction(async (manager) => {
      const [{ id }] = await manager.query(
        `INSERT INTO purchase_orders (number, "issueDate", "clientId", "licitationId", currency, total, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [dto.number.trim(), dto.issueDate ?? null, dto.clientId ?? null, dto.licitationId ?? null, dto.currency ?? null, dto.total ?? null, dto.notes ?? null],
      );
      await this.saveLinks(manager, id, dto);
      return id as number;
    });
    return this.findOne(id);
  }

  async update(id: number, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrderView> {
    await this.findOne(id);
    const columns = ["number", "issueDate", "clientId", "licitationId", "currency", "total", "notes"] as const;
    const changes = columns.filter((column) => dto[column] !== undefined);
    await this.dataSource.transaction(async (manager) => {
      if (changes.length > 0) {
        const sets = changes.map((column, i) => `"${column}" = $${i + 2}`).join(", ");
        const values = changes.map((column) => (column === "number" ? String(dto.number).trim() : dto[column]));
        await manager.query(`UPDATE purchase_orders SET ${sets}, "updatedAt" = now() WHERE id = $1`, [id, ...values]);
      }
      await this.saveLinks(manager, id, dto);
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.dataSource.query(`DELETE FROM purchase_orders WHERE id = $1 RETURNING id`, [id]);
    if (result.length === 0) throw new NotFoundException(`Orden de compra ${id} no encontrada`);
  }

  async attachFile(id: number, file: { fileName: string; mimeType: string; data: Buffer }): Promise<PurchaseOrderView> {
    await this.findOne(id);
    if (!ALLOWED_FILE.test(file.fileName)) throw new BadRequestException("Subí la orden en PDF o imagen (JPG, PNG)");
    if (file.data.length === 0) throw new BadRequestException("El archivo está vacío");
    await this.dataSource.query(
      `UPDATE purchase_orders SET "fileName" = $2, "mimeType" = $3, "fileSize" = $4, "fileData" = $5, "updatedAt" = now() WHERE id = $1`,
      [id, file.fileName.slice(0, 255), file.mimeType || "application/octet-stream", file.data.length, file.data],
    );
    return this.findOne(id);
  }

  async getFile(id: number): Promise<{ fileName: string; mimeType: string; fileData: Buffer }> {
    const [row] = await this.dataSource.query(`SELECT "fileName", "mimeType", "fileData" FROM purchase_orders WHERE id = $1`, [id]);
    if (!row) throw new NotFoundException(`Orden de compra ${id} no encontrada`);
    if (!row.fileData || !row.fileName) throw new NotFoundException("La orden no tiene archivo cargado");
    return { fileName: row.fileName, mimeType: row.mimeType ?? "application/octet-stream", fileData: row.fileData };
  }

  /** Replaces the linked invoices / remitos when the list is sent; leaves them as they are otherwise */
  private async saveLinks(manager: EntityManager, id: number, dto: UpdatePurchaseOrderDto) {
    if (dto.invoiceIds) {
      await manager.query(`DELETE FROM purchase_order_invoices WHERE "purchaseOrderId" = $1`, [id]);
      if (dto.invoiceIds.length > 0) {
        await manager.query(
          `INSERT INTO purchase_order_invoices ("purchaseOrderId", "billingDocumentId")
           SELECT $1, d.id FROM billing_documents d WHERE d.id = ANY($2::int[])`,
          [id, dto.invoiceIds],
        );
      }
    }
    if (dto.remitoIds) {
      await manager.query(`DELETE FROM purchase_order_remitos WHERE "purchaseOrderId" = $1`, [id]);
      if (dto.remitoIds.length > 0) {
        await manager.query(
          `INSERT INTO purchase_order_remitos ("purchaseOrderId", "remitoId")
           SELECT $1, r.id FROM remitos r WHERE r.id = ANY($2::int[])`,
          [id, dto.remitoIds],
        );
      }
    }
  }
}
