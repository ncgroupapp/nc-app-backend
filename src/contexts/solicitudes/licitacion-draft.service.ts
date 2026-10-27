import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Product } from "../products/entities/product.entity";
import { Solicitud } from "./entities/solicitud.entity";
import { MailSyncService } from "./mail-sync.service";
import { pdfToText } from "./pdf-text";
import {
  ParsedDeadline,
  RequestedLine,
  codePattern,
  findDeadline,
  findPliegoItems,
  findRequestedLines,
  normalizeCode,
  quantityNearCode,
} from "./licitacion-draft.parser";

/** PDFs bigger than this are skipped (scanned pliegos can be huge and have no text). */
const MAX_PDF_BYTES = 8 * 1024 * 1024;
/** Codes shorter than this match too many unrelated numbers. */
const MIN_CODE_LENGTH = 5;

export interface DraftProduct {
  productId: number;
  name: string;
  code: string | null;
  matchedCode: string;
  quantity: number | null;
  /** Another product of the catalog has the same code: the user has to pick the right one. */
  ambiguous: boolean;
}

export interface LicitacionDraft {
  solicitudId: number;
  /** When the mail arrived (start of the licitation). */
  startDate: string;
  deadline: ParsedDeadline | null;
  products: DraftProduct[];
  /** Requested lines that could not be matched to a product of the catalog. */
  unmatched: RequestedLine[];
  /** Where the data was read from (mail and PDF names) and what could not be read. */
  sources: Array<{ name: string; readable: boolean; chars: number }>;
}

@Injectable()
export class LicitacionDraftService {
  private readonly logger = new Logger(LicitacionDraftService.name);

  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudRepository: Repository<Solicitud>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly mailSyncService: MailSyncService,
  ) {}

  async buildDraft(solicitudId: number): Promise<LicitacionDraft> {
    const solicitud = await this.solicitudRepository
      .createQueryBuilder("solicitud")
      .leftJoinAndSelect("solicitud.messages", "message")
      .leftJoinAndSelect("message.attachments", "attachment")
      .where("solicitud.id = :id", { id: solicitudId })
      .orderBy("message.sentAt", "ASC")
      .getOne();
    if (!solicitud) throw new NotFoundException(`Solicitud ${solicitudId} no encontrada`);

    const sources: LicitacionDraft["sources"] = [];
    const texts: string[] = [];
    for (const message of (solicitud.messages ?? []).filter((m) => !m.outgoing)) {
      const body = message.bodyText ?? "";
      texts.push(body);
      sources.push({ name: `Mail ${message.subject ?? ""}`.trim(), readable: body.length > 0, chars: body.length });

      for (const attachment of message.attachments ?? []) {
        const isPdf = attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.filename);
        if (!isPdf) continue;
        if (attachment.size > MAX_PDF_BYTES) {
          sources.push({ name: attachment.filename, readable: false, chars: 0 });
          continue;
        }
        try {
          const file = await this.mailSyncService.downloadAttachment(attachment.id);
          const text = await pdfToText(file.data);
          texts.push(text);
          sources.push({ name: attachment.filename, readable: text.trim().length > 20, chars: text.length });
        } catch (error) {
          this.logger.warn(`Could not read ${attachment.filename}: ${error instanceof Error ? error.message : error}`);
          sources.push({ name: attachment.filename, readable: false, chars: 0 });
        }
      }
    }

    const fullText = texts.join("\n\n");
    const products = await this.matchProducts(fullText);
    const matchedLines = new Set<string>();
    for (const product of products) {
      for (const line of fullText.split(/\r?\n/)) {
        if (normalizeCode(line).includes(normalizeCode(product.matchedCode))) matchedLines.add(line.trim());
      }
    }
    const unmatched = [...findRequestedLines(fullText), ...findPliegoItems(fullText)].filter(
      (line) =>
        ![...matchedLines].some((matched) => matched.includes(line.description)) &&
        !products.some((p) => line.description.toUpperCase().includes(p.matchedCode.toUpperCase())),
    );

    return {
      solicitudId,
      startDate: solicitud.receivedAt.toISOString(),
      deadline: findDeadline(fullText, solicitud.receivedAt),
      products,
      unmatched,
      sources,
    };
  }

  /** Products of the catalog whose code or an equivalent code appears in the text. */
  private async matchProducts(text: string): Promise<DraftProduct[]> {
    if (!text.trim()) return [];
    // Split unit prefixes glued to article codes, e.g. Rivera's "un24082-0002BUJE" → "un 24082-0002 BUJE"
    const upper = text
      .replace(/^(UN|KG|LTS?|MTS?|M|PAR|JGO|CJ)(\d{4,6}-\d{3,4})/gim, "$1 $2 ")
      .toUpperCase();
    const products = await this.productRepository.find({ select: ["id", "name", "code", "equivalentCodes"] });

    const found: DraftProduct[] = [];
    for (const product of products) {
      const codes = [product.code, ...(product.equivalentCodes ?? [])].filter((c): c is string => {
        if (!c) return false;
        const normalized = normalizeCode(c);
        // Short or purely numeric codes collide with phone numbers, years and other ids
        return normalized.length >= MIN_CODE_LENGTH && (/[A-Z]/.test(normalized) || normalized.length >= 7);
      });
      const matchedCode = codes.find((code) => codePattern(code)?.test(upper));
      if (!matchedCode) continue;
      found.push({
        productId: product.id,
        name: product.name,
        code: product.code?.trim() ?? null,
        matchedCode,
        quantity: quantityNearCode(text, matchedCode),
        ambiguous: false,
      });
    }
    const byCode = new Map<string, number>();
    found.forEach((p) => byCode.set(normalizeCode(p.matchedCode), (byCode.get(normalizeCode(p.matchedCode)) ?? 0) + 1));
    return found.map((p) => ({ ...p, ambiguous: (byCode.get(normalizeCode(p.matchedCode)) ?? 0) > 1 }));
  }
}
