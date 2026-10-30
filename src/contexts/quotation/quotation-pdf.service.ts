import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { DataSource } from 'typeorm';
import { Quotation } from './entities/quotation.entity';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ObservationImageAsset, renderQuotationPdf } from './quotation-pdf.template';

/** Only images uploaded to the app's storage are downloaded into PDFs. */
const ALLOWED_IMAGE_HOST = 'firebasestorage.googleapis.com';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 10_000;

@Injectable()
export class QuotationPdfService implements OnModuleInit {
  private readonly logger = new Logger(QuotationPdfService.name);
  private readonly assetCache = new Map<string, Buffer | null>();

  constructor(private readonly dataSource: DataSource) {}

  /** Adds columns missing in older databases (migrations are not run on deploy). */
  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "observationImages" jsonb;
        ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "offerId" integer;
        ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "unitCost" numeric(12,2);
        ALTER TABLE "quotation_items" ADD COLUMN IF NOT EXISTS "costCurrency" character varying(3);
      `);
    } catch (error) {
      this.logger.error('Could not ensure quotation columns', error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * Genera un PDF de la cotización con diseño completo
   * @param quotation - Cotización a convertir en PDF
   * @returns Promise<Buffer> - Buffer del PDF generado
   */
  async generatePdf(quotation: Quotation): Promise<Buffer> {
    const [observationImages, clientLogo] = await Promise.all([
      this.loadObservationImages(quotation),
      this.loadClientLogo(quotation),
    ]);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 36, bottom: 20, left: 36, right: 36 },
          bufferPages: true,
          info: {
            Title: `Cotización ${quotation.quotationIdentifier}`,
            Author: 'Nicolas Cornalino',
            Subject: quotation.clientName || '',
          }
        });

        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        renderQuotationPdf(doc, quotation, {
          logo: this.loadAsset('logo.png'),
          signature: this.loadAsset('firma.png'),
          clientLogo,
          observationImages,
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Genera datos del PDF en formato base64 para preview
   * @param quotation - Cotización a convertir
   * @returns Promise<string> - String en base64 del PDF
   */
  async generatePdfBase64(quotation: Quotation): Promise<string> {
    const buffer = await this.generatePdf(quotation);
    return buffer.toString('base64');
  }

  /**
   * Downloads the observation images at their original resolution. Images that fail,
   * are not PNG/JPEG (the formats PDFKit embeds) or are not from the app storage are skipped.
   */
  private async loadObservationImages(quotation: Quotation): Promise<ObservationImageAsset[]> {
    const images = quotation.observationImages ?? [];
    const loaded = await Promise.all(
      images.map(async (image): Promise<ObservationImageAsset | null> => {
        try {
          const url = new URL(image.url);
          if (url.protocol !== 'https:' || url.hostname !== ALLOWED_IMAGE_HOST) return null;
          const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = Buffer.from(await response.arrayBuffer());
          if (data.length > MAX_IMAGE_BYTES) throw new Error('imagen demasiado grande');
          const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
          const isJpeg = data[0] === 0xff && data[1] === 0xd8;
          if (!isPng && !isJpeg) throw new Error('formato no soportado (solo PNG o JPG)');
          return { data, caption: image.caption?.trim() || null };
        } catch (error) {
          this.logger.warn(`Observation image skipped (${image.url}): ${error instanceof Error ? error.message : error}`);
          return null;
        }
      }),
    );
    return loaded.filter((image): image is ObservationImageAsset => image !== null);
  }

  /** Logo of the quotation's client (from its licitation, or the quotation itself); null when it has none. */
  private async loadClientLogo(quotation: Quotation): Promise<Buffer | null> {
    const clientId = quotation.licitation?.client?.id ?? quotation.licitation?.clientId ?? quotation.clientId;
    if (!clientId) return null;
    try {
      const rows: Array<{ logoData: Buffer | null }> = await this.dataSource.query(
        'SELECT "logoData" FROM "clients" WHERE "id" = $1',
        [clientId],
      );
      return rows[0]?.logoData ?? null;
    } catch (error) {
      this.logger.warn(`Client logo not loaded: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private loadAsset(fileName: string): Buffer | null {
    if (this.assetCache.has(fileName)) {
      return this.assetCache.get(fileName) ?? null;
    }

    const possiblePaths = [
      join(process.cwd(), 'assets', fileName),
      join(__dirname, '..', '..', '..', 'assets', fileName),
      join(process.cwd(), 'dist', 'assets', fileName),
    ];

    let buffer: Buffer | null = null;
    for (const path of possiblePaths) {
      try {
        buffer = readFileSync(path);
        break;
      } catch {
        continue;
      }
    }

    this.assetCache.set(fileName, buffer);
    return buffer;
  }
}
