import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { readFileSync } from "fs";
import { join } from "path";
import { Remito, RemitoStatus } from "./entities/remito.entity";
import { ShippingGuide } from "./entities/shipping-guide.entity";
import { formatRemitoNumber, renderRemitoPdf } from "./remito-pdf.template";
import { renderShippingGuidesPdf } from "./shipping-guide-pdf.template";

@Injectable()
export class RemitosPdfService {
  private readonly assets = new Map<string, Buffer | null>();

  async generateRemitoPdf(remito: Remito): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 36, bottom: 20, left: 36, right: 36 },
      bufferPages: true,
      info: { Title: `Remito ${formatRemitoNumber(remito.number)}`, Author: "NC GROUP SAS", Subject: remito.receiverName },
    });
    return this.collect(doc, () =>
      renderRemitoPdf(
        doc,
        {
          ...remito,
          cancelled: remito.status === RemitoStatus.CANCELLED,
          items: [...(remito.items ?? [])].sort((a, b) => a.position - b.position),
        },
        this.loadAsset("logo.png"),
      ),
    );
  }

  async generateGuidesPdf(guides: ShippingGuide[]): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      info: { Title: "Datos de envío", Author: "NC GROUP SAS" },
    });
    return this.collect(doc, () => renderShippingGuidesPdf(doc, guides, {
        logoWhite: this.loadAsset("logo-blanco.png"),
        logo: this.loadAsset("logo.png"),
      }));
  }

  private collect(doc: PDFKit.PDFDocument, render: () => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const buffers: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
      try {
        render();
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private loadAsset(fileName: string): Buffer | null {
    if (this.assets.has(fileName)) return this.assets.get(fileName) ?? null;
    const possiblePaths = [
      join(process.cwd(), "assets", fileName),
      join(__dirname, "..", "..", "..", "assets", fileName),
      join(process.cwd(), "dist", "assets", fileName),
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
    this.assets.set(fileName, buffer);
    return buffer;
  }
}
