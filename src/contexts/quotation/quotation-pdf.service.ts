import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Quotation } from './entities/quotation.entity';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderQuotationPdf } from './quotation-pdf.template';

@Injectable()
export class QuotationPdfService {
  private readonly assetCache = new Map<string, Buffer | null>();

  /**
   * Genera un PDF de la cotización con diseño completo
   * @param quotation - Cotización a convertir en PDF
   * @returns Promise<Buffer> - Buffer del PDF generado
   */
  async generatePdf(quotation: Quotation): Promise<Buffer> {
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
