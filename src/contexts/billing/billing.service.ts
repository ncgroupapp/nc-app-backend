import { createHash } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, Repository, SelectQueryBuilder } from "typeorm";
import { MatchableClient, matchClient } from "./client-matcher";
import { readPdf } from "./pdf-reader";
import { CREATE_BILLING_DOCUMENTS_TABLE_SQL } from "./billing-documents.table";
import {
  NotABillingDocumentError,
  ParsedBillingDocument,
  isPdfFile,
  isXmlFile,
  parseCfeXml,
  parsePdfText,
} from "./billing-document.parser";
import { FilterBillingDocumentsDto, UpdateBillingDocumentDto } from "./dto/billing.dto";
import { BillingDocument, BillingDocumentSource, BillingDocumentType } from "./entities/billing-document.entity";

export const MAX_BILLING_FILE_SIZE = 10 * 1024 * 1024;

export interface IncomingBillingFile {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export type IngestResult =
  | { status: "created"; document: BillingDocument }
  | { status: "duplicate"; document: BillingDocument }
  | { status: "skipped"; fileName: string; reason: string };

/** Numeric value of the document number ("0001234" → 1234), so 10 sorts after 9 */
const NUMBER_SQL = `CAST(NULLIF(regexp_replace(doc.number, '\\D', '', 'g'), '') AS bigint)`;

export interface BillingSummaryRow {
  currency: string;
  invoiceCount: number;
  invoiceTotal: number;
  creditNoteCount: number;
  creditNoteTotal: number;
  net: number;
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingDocument)
    private readonly repository: Repository<BillingDocument>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(CREATE_BILLING_DOCUMENTS_TABLE_SQL);
    } catch (error) {
      this.logger.error(
        "Could not ensure billing_documents table",
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Stores a PDF/XML exported by the billing system, reading its data. The same file twice is stored once. */
  async ingest(file: IncomingBillingFile, source: BillingDocumentSource): Promise<IngestResult> {
    const { fileName, mimeType, data } = file;
    if (!isPdfFile(fileName, mimeType) && !isXmlFile(fileName, mimeType)) {
      return { status: "skipped", fileName, reason: "Solo se aceptan archivos PDF o XML" };
    }
    if (data.length === 0) return { status: "skipped", fileName, reason: "El archivo está vacío" };
    if (data.length > MAX_BILLING_FILE_SIZE) {
      return { status: "skipped", fileName, reason: "El archivo supera los 10 MB" };
    }

    const fileHash = createHash("sha256").update(data).digest("hex");
    const sameFile = await this.repository.findOne({ where: { fileHash } });
    if (sameFile) return { status: "duplicate", document: sameFile };

    let parsed: ParsedBillingDocument;
    let rawText: string;
    try {
      ({ parsed, rawText } = await this.read(fileName, mimeType, data));
    } catch (error) {
      if (error instanceof NotABillingDocumentError) return { status: "skipped", fileName, reason: error.message };
      throw error;
    }

    // The PDF and the XML of the same document (or a re-export) count as the same document
    if (parsed.number) {
      const sameDocument = await this.repository
        .createQueryBuilder("doc")
        .where("doc.type = :type", { type: parsed.type })
        .andWhere("doc.number = :number", { number: parsed.number })
        .andWhere("doc.series IS NOT DISTINCT FROM :series", { series: parsed.series })
        .getOne();
      if (sameDocument) return { status: "duplicate", document: sameDocument };
    }

    const saved = await this.repository.save(
      this.repository.create({
        ...parsed,
        ...this.linkClient(parsed, await this.loadClients()),
        rawText,
        source,
        fileName: fileName.slice(0, 255),
        mimeType: isXmlFile(fileName, mimeType) ? "application/xml" : "application/pdf",
        fileSize: data.length,
        fileHash,
        fileData: data,
      }),
    );
    // Never send the file bytes back in JSON responses
    const { fileData: _fileData, rawText: _rawText, ...document } = saved;
    this.logger.log(`Stored ${parsed.type} ${parsed.series ?? ""}${parsed.number ?? "?"} from ${fileName}`);
    return { status: "created", document: document as BillingDocument };
  }

  /**
   * Reads the data again from the stored files (all documents flagged for review, or the given ones).
   * Fields corrected by hand are only replaced when the file now gives a value for them.
   */
  async reprocess(
    ids?: number[],
  ): Promise<{ processed: number; fixed: number; stillNeedReview: number; duplicates: number; linkedClients: number }> {
    const query = this.repository
      .createQueryBuilder("doc")
      .addSelect("doc.fileData")
      .orderBy("doc.id", "ASC");
    if (ids?.length) query.where("doc.id IN (:...ids)", { ids });
    else query.where("doc.needsReview = true");
    const documents = await query.getMany();

    let fixed = 0;
    for (const document of documents) {
      try {
        const { parsed, rawText } = await this.read(document.fileName, document.mimeType, document.fileData);
        const updates: Partial<BillingDocument> = { rawText };
        for (const [key, value] of Object.entries(parsed) as [keyof ParsedBillingDocument, unknown][]) {
          if (key === "needsReview") continue;
          if (value !== null && value !== undefined) (updates as Record<string, unknown>)[key] = value;
        }
        if (document.clientMatch !== "manual" && (updates.clientName || updates.clientRut)) {
          const link = this.linkClient({ ...document, ...updates }, await this.loadClients());
          // Keep an existing link when the new data matches no client
          if (link.clientId) Object.assign(updates, link);
        }
        const merged = { ...document, ...updates };
        updates.needsReview = !merged.number || !merged.issueDate || merged.total === null;
        if (document.needsReview && !updates.needsReview) fixed++;
        await this.repository.update(document.id, updates);
      } catch (error) {
        this.logger.warn(`Could not re-read document ${document.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    const linkedClients = await this.linkUnlinkedClients();
    const stillNeedReview = await this.repository.count({ where: { needsReview: true } });
    // Files that had no readable number could be the same document uploaded twice (PDF and XML, re-downloads)
    const [{ duplicates }] = await this.dataSource.query(
      `SELECT COALESCE(SUM(n - 1), 0)::int AS duplicates FROM (
         SELECT count(*) AS n FROM billing_documents WHERE number IS NOT NULL
          GROUP BY type, series, number HAVING count(*) > 1
       ) repeated`,
    );
    return { processed: documents.length, fixed, stillNeedReview, duplicates, linkedClients };
  }

  /** Links to a client of the app every document that has none yet (e.g. after loading new clients) */
  async linkUnlinkedClients(): Promise<number> {
    const clients = await this.loadClients();
    if (clients.length === 0) return 0;
    const documents: Array<{ id: number; clientName: string | null; clientRut: string | null }> = await this.dataSource.query(
      `SELECT id, "clientName", "clientRut" FROM billing_documents
        WHERE "clientId" IS NULL AND ("clientName" IS NOT NULL OR "clientRut" IS NOT NULL)`,
    );
    let linked = 0;
    for (const document of documents) {
      const link = this.linkClient(document, clients);
      if (!link.clientId) continue;
      await this.repository.update(document.id, link);
      linked++;
    }
    return linked;
  }

  private async loadClients(): Promise<MatchableClient[]> {
    return this.dataSource.query(`SELECT id, name, identifier FROM clients`);
  }

  private linkClient(
    document: { clientName?: string | null; clientRut?: string | null },
    clients: readonly MatchableClient[],
  ): Pick<BillingDocument, "clientId" | "clientMatch"> {
    const match = matchClient(document, clients);
    return { clientId: match?.clientId ?? null, clientMatch: match?.by ?? null };
  }

  /** Text read from the file, to check why a document could not be understood */
  async getRawText(id: number): Promise<{ fileName: string; text: string }> {
    const document = await this.repository
      .createQueryBuilder("doc")
      .select(["doc.id", "doc.fileName"])
      .addSelect("doc.rawText")
      .where("doc.id = :id", { id })
      .getOne();
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);
    return { fileName: document.fileName, text: document.rawText ?? "" };
  }

  async findAll(filters: FilterBillingDocumentsDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 200);

    const query = this.applyFilters(this.repository.createQueryBuilder("doc"), filters, true)
      .addSelect(["client.id", "client.name", "client.identifier"])
      .addSelect(NUMBER_SQL, "number_value")
      // offset/limit instead of skip/take: the join is many-to-one, so rows are not multiplied
      .offset((page - 1) * limit)
      .limit(limit);
    const sort = filters.sort ?? "numero_desc";
    if (sort === "fecha_desc") {
      query.orderBy("doc.issueDate", "DESC", "NULLS LAST").addOrderBy("number_value", "DESC", "NULLS LAST");
    } else {
      const direction = sort === "numero_asc" ? "ASC" : "DESC";
      // Invoices and credit notes have their own numbering: keep each correlative together
      query
        .orderBy("doc.type", "ASC")
        .addOrderBy("doc.series", direction, "NULLS LAST")
        .addOrderBy("number_value", direction, "NULLS LAST");
    }
    query.addOrderBy("doc.id", "DESC");
    const [data, total] = await query.getManyAndCount();

    return {
      data,
      meta: { total, page, limit, lastPage: Math.max(1, Math.ceil(total / limit)) },
      summary: await this.summary(filters),
    };
  }

  /** Totals per currency for the same filters; credit notes are subtracted in "net" */
  async summary(filters: FilterBillingDocumentsDto): Promise<BillingSummaryRow[]> {
    const rows = await this.applyFilters(this.repository.createQueryBuilder("doc"), filters, false)
      .select(`COALESCE(doc.currency, '-')`, "currency")
      .addSelect(`COUNT(*) FILTER (WHERE doc.type = :invoice)`, "invoiceCount")
      .addSelect(`COALESCE(SUM(doc.total) FILTER (WHERE doc.type = :invoice), 0)`, "invoiceTotal")
      .addSelect(`COUNT(*) FILTER (WHERE doc.type = :credit)`, "creditNoteCount")
      .addSelect(`COALESCE(SUM(doc.total) FILTER (WHERE doc.type = :credit), 0)`, "creditNoteTotal")
      .setParameters({ invoice: BillingDocumentType.INVOICE, credit: BillingDocumentType.CREDIT_NOTE })
      .groupBy(`COALESCE(doc.currency, '-')`)
      .getRawMany<Record<string, string>>();

    return rows.map((row) => {
      const invoiceTotal = Number(row.invoiceTotal);
      const creditNoteTotal = Math.abs(Number(row.creditNoteTotal));
      return {
        currency: row.currency,
        invoiceCount: Number(row.invoiceCount),
        invoiceTotal,
        creditNoteCount: Number(row.creditNoteCount),
        creditNoteTotal,
        net: Math.round((invoiceTotal - creditNoteTotal) * 100) / 100,
      };
    });
  }

  async findOne(id: number): Promise<BillingDocument> {
    const document = await this.repository
      .createQueryBuilder("doc")
      .leftJoin("doc.client", "client")
      .addSelect(["client.id", "client.name", "client.identifier"])
      .where("doc.id = :id", { id })
      .getOne();
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);
    return document;
  }

  async getFile(id: number): Promise<Pick<BillingDocument, "fileName" | "mimeType" | "fileData">> {
    const document = await this.repository
      .createQueryBuilder("doc")
      .select(["doc.id", "doc.fileName", "doc.mimeType"])
      .addSelect("doc.fileData")
      .where("doc.id = :id", { id })
      .getOne();
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);
    return document;
  }

  async update(id: number, dto: UpdateBillingDocumentDto): Promise<BillingDocument> {
    const document = await this.findOne(id);
    if (Object.keys(dto).length === 0) throw new BadRequestException("No hay cambios para guardar");
    Object.assign(document, dto);
    if (dto.clientId !== undefined) {
      document.clientMatch = dto.clientId ? "manual" : null;
    } else if (document.clientMatch !== "manual" && (dto.clientName !== undefined || dto.clientRut !== undefined)) {
      Object.assign(document, this.linkClient(document, await this.loadClients()));
    }
    document.needsReview = !document.number || !document.issueDate || document.total === null;
    // Drop the loaded relation so the new clientId is what gets saved
    delete document.client;
    await this.repository.save(document);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.repository.delete(id);
    if (!result.affected) throw new NotFoundException(`Documento ${id} no encontrado`);
  }

  private async read(fileName: string, mimeType: string, data: Buffer) {
    if (isXmlFile(fileName, mimeType)) {
      const xml = data.toString("utf8");
      return { parsed: parseCfeXml(xml), rawText: xml.slice(0, 20_000) };
    }
    const { text, cells } = await readPdf(data);
    const parsed = parsePdfText(text, fileName, this.configService.get<string>("BILLING_COMPANY_RUT"), cells);
    if (!text) this.logger.warn(`${fileName}: the PDF has no text (scanned image?)`);
    return { parsed, rawText: text.slice(0, 20_000) };
  }

  private applyFilters(
    query: SelectQueryBuilder<BillingDocument>,
    filters: FilterBillingDocumentsDto,
    includeType: boolean,
  ): SelectQueryBuilder<BillingDocument> {
    query.leftJoin("doc.client", "client");
    if (includeType && filters.type) query.andWhere("doc.type = :type", { type: filters.type });
    if (filters.clientId) query.andWhere("doc.clientId = :clientId", { clientId: filters.clientId });
    if (filters.currency) query.andWhere("doc.currency = :currency", { currency: filters.currency });
    if (filters.dateFrom) query.andWhere("doc.issueDate >= :dateFrom", { dateFrom: filters.dateFrom });
    if (filters.dateTo) query.andWhere("doc.issueDate <= :dateTo", { dateTo: filters.dateTo });
    const search = filters.search?.trim();
    if (search) {
      const compact = search.replace(/[\s-]/g, "");
      query.andWhere(
        new Brackets((qb) => {
          qb.where("doc.clientName ILIKE :search", { search: `%${search}%` })
            .orWhere("client.name ILIKE :search")
            .orWhere("doc.clientRut ILIKE :search")
            .orWhere("doc.fileName ILIKE :search")
            .orWhere("doc.referenceNumber ILIKE :search")
            .orWhere("CONCAT(COALESCE(doc.series, ''), doc.number) ILIKE :compact", {
              compact: `%${compact.replace(/^([A-Za-z]*)0+/, "$1")}%`,
            });
        }),
      );
    }
    return query;
  }
}
