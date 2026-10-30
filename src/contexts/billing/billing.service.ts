import { createHash } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, Repository, SelectQueryBuilder } from "typeorm";
import { pdfToText } from "../solicitudes/pdf-text";
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
    try {
      parsed = isXmlFile(fileName, mimeType)
        ? parseCfeXml(data.toString("utf8"))
        : parsePdfText(await pdfToText(data), fileName, this.configService.get<string>("BILLING_COMPANY_RUT"));
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
        source,
        fileName: fileName.slice(0, 255),
        mimeType: isXmlFile(fileName, mimeType) ? "application/xml" : "application/pdf",
        fileSize: data.length,
        fileHash,
        fileData: data,
      }),
    );
    // Never send the file bytes back in JSON responses
    const { fileData: _fileData, ...document } = saved;
    this.logger.log(`Stored ${parsed.type} ${parsed.series ?? ""}${parsed.number ?? "?"} from ${fileName}`);
    return { status: "created", document: document as BillingDocument };
  }

  async findAll(filters: FilterBillingDocumentsDto) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 200);

    const query = this.applyFilters(this.repository.createQueryBuilder("doc"), filters, true)
      .orderBy("doc.issueDate", "DESC", "NULLS LAST")
      .addOrderBy("doc.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit);
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
    const document = await this.repository.findOne({ where: { id } });
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
    document.needsReview = !document.number || !document.issueDate || document.total === null;
    return this.repository.save(document);
  }

  async remove(id: number): Promise<void> {
    const result = await this.repository.delete(id);
    if (!result.affected) throw new NotFoundException(`Documento ${id} no encontrado`);
  }

  private applyFilters(
    query: SelectQueryBuilder<BillingDocument>,
    filters: FilterBillingDocumentsDto,
    includeType: boolean,
  ): SelectQueryBuilder<BillingDocument> {
    if (includeType && filters.type) query.andWhere("doc.type = :type", { type: filters.type });
    if (filters.currency) query.andWhere("doc.currency = :currency", { currency: filters.currency });
    if (filters.dateFrom) query.andWhere("doc.issueDate >= :dateFrom", { dateFrom: filters.dateFrom });
    if (filters.dateTo) query.andWhere("doc.issueDate <= :dateTo", { dateTo: filters.dateTo });
    const search = filters.search?.trim();
    if (search) {
      const compact = search.replace(/[\s-]/g, "");
      query.andWhere(
        new Brackets((qb) => {
          qb.where("doc.clientName ILIKE :search", { search: `%${search}%` })
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
