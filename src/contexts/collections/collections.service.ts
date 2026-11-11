import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import PDFDocument from "pdfkit";
import { DataSource, EntityManager } from "typeorm";
import { CollectionTotals, PROFIT_PARTNERS, collectionTotals, renderCollectionPdf } from "./collection-pdf.template";
import { CREATE_COLLECTIONS_TABLES_SQL } from "./collections.table";
import { PendingInvoicesDto, SaveCollectionDto, UpdateCollectionDto } from "./dto/collection.dto";

export interface CollectionInvoice {
  id: number;
  /** "A-1203" */
  label: string;
  issueDate: string | null;
  currency: string | null;
  net: number;
  tax: number;
  total: number;
  clientId: number | null;
  clientName: string | null;
  clientRut: string | null;
}

export type ClientKind = "publico" | "privado";

export interface CollectionView {
  id: number;
  /** "CB-0001" */
  number: string;
  date: string;
  clientId: number | null;
  clientName: string;
  clientRut: string | null;
  clientKind: ClientKind;
  currency: string;
  amountReceived: number;
  bank: string | null;
  reference: string | null;
  cost: number;
  purchaseTax: number;
  licitation: { id: number; callNumber: string; internalNumber: string | null } | null;
  notes: string | null;
  invoices: CollectionInvoice[];
  totals: CollectionTotals;
  createdAt: string;
}

/**
 * Net of an invoice. Many loaded invoices have the net stored in "tax" and 0 in "subtotal", so:
 * use subtotal when subtotal + tax adds up to the total; else "tax" when it is the net at the 22 % or 10 %
 * rate; else the total without the basic 22 % VAT.
 */
const NET_SQL = `
  CASE
    WHEN d.subtotal > 0 AND abs(d.subtotal + COALESCE(d.tax, 0) - d.total) <= 0.05 THEN d.subtotal
    WHEN d.tax > 0 AND abs(round(d.tax * 1.22, 2) - d.total) <= 0.05 THEN d.tax
    WHEN d.tax > 0 AND abs(round(d.tax * 1.10, 2) - d.total) <= 0.05 THEN d.tax
    ELSE round(COALESCE(d.total, 0) / 1.22, 2)
  END`;

/** Net, VAT (total minus net) and total of an invoice */
const INVOICE_COLUMNS = `
  d.id, concat_ws('-', NULLIF(d.series, ''), d.number) AS label, to_char(d."issueDate", 'YYYY-MM-DD') AS "issueDate",
  d.currency, d."clientId", COALESCE(c.name, d."clientName") AS "clientName", d."clientRut",
  (${NET_SQL})::float AS net,
  (COALESCE(d.total, 0) - ${NET_SQL})::float AS tax,
  COALESCE(d.total, 0)::float AS total
`;

/** Public bodies: by name, or by the RUT prefix the state agencies use */
const PUBLIC_NAME =
  /\b(INTENDENCIA|MINISTERIO|DIRECCION NACIONAL|ADMINISTRACION NACIONAL|ASSE|HOSPITAL|UTE|ANCAP|OSE|ANTEL|JUNTA|BOMBEROS|INSTITUTO NACIONAL|UNIVERSIDAD DE LA REPUBLICA|PODER|MUNICIPIO|ARMADA|EJERCITO|FUERZA AEREA|POLICIA|BANCO DE LA REPUBLICA|BANCO DE PREVISION|BANCO DE SEGUROS|INAU|INISA|CORREO|PRESIDENCIA|PARLAMENTO|FISCALIA)\b/;

export function clientKind(name: string | null, rut: string | null): ClientKind {
  const plain = (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (PUBLIC_NAME.test(plain)) return "publico";
  if (rut && /^21\d{10}$/.test(rut.replace(/\D/g, ""))) return "publico";
  return "privado";
}

@Injectable()
export class CollectionsService implements OnModuleInit {
  private readonly logger = new Logger(CollectionsService.name);
  private logo: Buffer | null | undefined;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_COLLECTIONS_TABLES_SQL);
    } catch (error) {
      this.logger.error("Could not ensure collections tables", error instanceof Error ? error.stack : String(error));
    }
  }

  async findAll(): Promise<{ items: CollectionView[]; partners: typeof PROFIT_PARTNERS }> {
    const rows = await this.baseQuery(this.dataSource.manager);
    return { items: rows, partners: PROFIT_PARTNERS };
  }

  async findOne(id: number, manager: EntityManager = this.dataSource.manager): Promise<CollectionView> {
    const [row] = await this.baseQuery(manager, id);
    if (!row) throw new NotFoundException(`No existe la cobranza ${id}`);
    return row;
  }

  /** Invoices still unpaid and not in another collection, optionally of one client */
  async pendingInvoices(filters: PendingInvoicesDto): Promise<CollectionInvoice[]> {
    const params: unknown[] = [];
    let available = `(d."paidAt" IS NULL AND NOT EXISTS (SELECT 1 FROM collection_invoices ci WHERE ci."billingDocumentId" = d.id))`;
    if (filters.collectionId) {
      params.push(filters.collectionId);
      available = `(${available} OR d.id IN (SELECT "billingDocumentId" FROM collection_invoices WHERE "collectionId" = $${params.length}))`;
    }
    let where = `d.type = 'factura' AND ${available}`;
    if (filters.clientId) {
      params.push(filters.clientId);
      where += ` AND d."clientId" = $${params.length}`;
    }
    return this.dataSource.query(
      `SELECT ${INVOICE_COLUMNS} FROM billing_documents d LEFT JOIN clients c ON c.id = d."clientId"
       WHERE ${where} ORDER BY d."issueDate" ASC NULLS LAST, d.id ASC`,
      params,
    );
  }

  async create(dto: SaveCollectionDto): Promise<CollectionView> {
    return this.dataSource.transaction(async (manager) => {
      const invoices = await this.checkInvoices(manager, dto.invoiceIds, null);
      const first = invoices[0];
      const [{ id }] = await manager.query(
        `INSERT INTO collections ("date", "clientId", "clientName", "clientRut", "currency", "amountReceived", "bank", "reference",
                                  "cost", "purchaseTax", "licitationId", "notes")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          dto.date,
          first.clientId,
          first.clientName,
          first.clientRut,
          first.currency ?? "UYU",
          dto.amountReceived,
          dto.bank?.trim() || null,
          dto.reference?.trim() || null,
          dto.cost ?? 0,
          dto.purchaseTax ?? 0,
          dto.licitationId ?? null,
          dto.notes?.trim() || null,
        ],
      );
      await this.linkInvoices(manager, id, dto.invoiceIds, dto.date);
      return this.findOne(id, manager);
    });
  }

  async update(id: number, dto: UpdateCollectionDto): Promise<CollectionView> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findOne(id, manager);
      const date = dto.date ?? current.date;
      let client = { clientId: current.clientId, clientName: current.clientName, clientRut: current.clientRut, currency: current.currency };

      if (dto.invoiceIds) {
        const invoices = await this.checkInvoices(manager, dto.invoiceIds, id);
        const first = invoices[0];
        client = { clientId: first.clientId, clientName: first.clientName ?? current.clientName, clientRut: first.clientRut, currency: first.currency ?? current.currency };
        await this.unlinkInvoices(manager, id);
        await this.linkInvoices(manager, id, dto.invoiceIds, date);
      } else if (dto.date) {
        await manager.query(
          `UPDATE billing_documents SET "paidAt" = $2 WHERE id IN (SELECT "billingDocumentId" FROM collection_invoices WHERE "collectionId" = $1)`,
          [id, date],
        );
      }

      await manager.query(
        `UPDATE collections SET "date" = $2, "clientId" = $3, "clientName" = $4, "clientRut" = $5, "currency" = $6,
                "amountReceived" = $7, "bank" = $8, "reference" = $9, "cost" = $10, "purchaseTax" = $11,
                "licitationId" = $12, "notes" = $13, "updatedAt" = now()
         WHERE id = $1`,
        [
          id,
          date,
          client.clientId,
          client.clientName,
          client.clientRut,
          client.currency,
          dto.amountReceived ?? current.amountReceived,
          dto.bank !== undefined ? dto.bank?.trim() || null : current.bank,
          dto.reference !== undefined ? dto.reference?.trim() || null : current.reference,
          dto.cost ?? current.cost,
          dto.purchaseTax ?? current.purchaseTax,
          dto.licitationId !== undefined ? dto.licitationId : current.licitation?.id ?? null,
          dto.notes !== undefined ? dto.notes?.trim() || null : current.notes,
        ],
      );
      return this.findOne(id, manager);
    });
  }

  /** Deletes the collection; its invoices go back to "to collect" */
  async remove(id: number): Promise<{ id: number }> {
    return this.dataSource.transaction(async (manager) => {
      await this.findOne(id, manager);
      await this.unlinkInvoices(manager, id);
      await manager.query(`DELETE FROM collections WHERE id = $1`, [id]);
      return { id };
    });
  }

  async pdf(id: number): Promise<{ fileName: string; data: Buffer }> {
    const c = await this.findOne(id);
    const data = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 36, bottom: 20, left: 40, right: 40 },
        info: { Title: `Cobranza ${c.number}`, Author: "NC Group SAS", Subject: c.clientName },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      renderCollectionPdf(
        doc,
        {
          number: c.number,
          date: c.date,
          currency: c.currency,
          clientName: c.clientName,
          clientRut: c.clientRut,
          bank: c.bank,
          reference: c.reference,
          amountReceived: c.amountReceived,
          invoices: c.invoices,
          cost: c.cost,
          purchaseTax: c.purchaseTax,
          notes: c.notes,
        },
        { logo: this.loadLogo() },
      );
      doc.end();
    });
    return { fileName: `Cobranza ${c.number} - ${c.clientName}.pdf`.replace(/[\\/:*?"<>|]/g, " "), data };
  }

  private async baseQuery(manager: EntityManager, id?: number): Promise<CollectionView[]> {
    const rows: Array<Omit<CollectionView, "number" | "clientKind" | "totals">> = await manager.query(
      `SELECT col.id, to_char(col."date", 'YYYY-MM-DD') AS date, col."clientId",
              COALESCE(cl.name, col."clientName", 'Sin cliente') AS "clientName", col."clientRut", col.currency,
              col."amountReceived"::float AS "amountReceived", col.bank, col.reference, col.cost::float AS cost,
              col."purchaseTax"::float AS "purchaseTax", col.notes, col."createdAt",
              CASE WHEN l.id IS NULL THEN NULL
                   ELSE json_build_object('id', l.id, 'callNumber', l."callNumber", 'internalNumber', l."internalNumber") END AS licitation,
              COALESCE((SELECT json_agg(inv ORDER BY inv."issueDate", inv.id) FROM (
                  SELECT ${INVOICE_COLUMNS} FROM collection_invoices ci
                  JOIN billing_documents d ON d.id = ci."billingDocumentId" LEFT JOIN clients c ON c.id = d."clientId"
                  WHERE ci."collectionId" = col.id) inv), '[]') AS invoices
       FROM collections col
       LEFT JOIN clients cl ON cl.id = col."clientId"
       LEFT JOIN licitations l ON l.id = col."licitationId"
       ${id ? "WHERE col.id = $1" : ""}
       ORDER BY col."date" DESC, col.id DESC`,
      id ? [id] : [],
    );
    return rows.map((row) => ({
      ...row,
      number: `CB-${String(row.id).padStart(4, "0")}`,
      clientKind: clientKind(row.clientName, row.clientRut),
      totals: collectionTotals(row),
    }));
  }

  /** The invoices must exist, be unpaid invoices not in another collection, and share client and currency */
  private async checkInvoices(manager: EntityManager, ids: number[], collectionId: number | null): Promise<CollectionInvoice[]> {
    const rows: Array<CollectionInvoice & { type: string; paidAt: string | null; otherCollection: number | null }> = await manager.query(
      `SELECT ${INVOICE_COLUMNS}, d.type, d."paidAt",
              (SELECT ci."collectionId" FROM collection_invoices ci WHERE ci."billingDocumentId" = d.id) AS "otherCollection"
       FROM billing_documents d LEFT JOIN clients c ON c.id = d."clientId"
       WHERE d.id = ANY($1)`,
      [ids],
    );
    if (rows.length !== ids.length) throw new BadRequestException("Alguna de las facturas no existe");
    for (const row of rows) {
      if (row.type !== "factura") throw new BadRequestException(`${row.label} no es una factura`);
      if (row.otherCollection && row.otherCollection !== collectionId) {
        throw new BadRequestException(`La factura ${row.label} ya está en la cobranza CB-${String(row.otherCollection).padStart(4, "0")}`);
      }
      if (row.paidAt && !row.otherCollection) {
        throw new BadRequestException(`La factura ${row.label} ya está marcada como cobrada`);
      }
    }
    if (new Set(rows.map((r) => r.currency ?? "")).size > 1) {
      throw new BadRequestException("Las facturas de una cobranza tienen que ser de la misma moneda");
    }
    if (new Set(rows.map((r) => r.clientId ?? r.clientName ?? "")).size > 1) {
      throw new BadRequestException("Las facturas de una cobranza tienen que ser del mismo cliente");
    }
    return rows;
  }

  private async linkInvoices(manager: EntityManager, collectionId: number, ids: number[], date: string): Promise<void> {
    await manager.query(
      `INSERT INTO collection_invoices ("collectionId", "billingDocumentId") SELECT $1, unnest($2::int[])`,
      [collectionId, ids],
    );
    await manager.query(`UPDATE billing_documents SET "paidAt" = $2 WHERE id = ANY($1)`, [ids, date]);
  }

  private async unlinkInvoices(manager: EntityManager, collectionId: number): Promise<void> {
    await manager.query(
      `UPDATE billing_documents SET "paidAt" = NULL WHERE id IN (SELECT "billingDocumentId" FROM collection_invoices WHERE "collectionId" = $1)`,
      [collectionId],
    );
    await manager.query(`DELETE FROM collection_invoices WHERE "collectionId" = $1`, [collectionId]);
  }

  private loadLogo(): Buffer | null {
    if (this.logo !== undefined) return this.logo;
    const paths = [
      join(process.cwd(), "assets", "logo.png"),
      join(__dirname, "..", "..", "..", "assets", "logo.png"),
      join(process.cwd(), "dist", "assets", "logo.png"),
    ];
    this.logo = null;
    for (const path of paths) {
      try {
        this.logo = readFileSync(path);
        break;
      } catch {
        continue;
      }
    }
    return this.logo;
  }
}
