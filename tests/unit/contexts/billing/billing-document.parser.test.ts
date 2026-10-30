import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import {
  NotABillingDocumentError,
  parseAmount,
  parseCfeXml,
  parseDate,
  parsePdfText,
} from "../../../../src/contexts/billing/billing-document.parser";
import { readPdfText } from "../../../../src/contexts/billing/pdf-reader";

const COMPANY_RUT = "217654320018";

const cfeXml = (tipo: number, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<ns0:CFE xmlns:ns0="http://cfe.dgi.gub.uy"><ns0:eFact><ns0:Encabezado>
  <ns0:IdDoc><ns0:TipoCFE>${tipo}</ns0:TipoCFE><ns0:Serie>A</ns0:Serie><ns0:Nro>1234</ns0:Nro><ns0:FchEmis>2026-10-15</ns0:FchEmis></ns0:IdDoc>
  <ns0:Emisor><ns0:RUCEmisor>${COMPANY_RUT}</ns0:RUCEmisor></ns0:Emisor>
  <ns0:Receptor><ns0:DocRecep>210000000017</ns0:DocRecep><ns0:RznSocRecep>Hospital de Clínicas</ns0:RznSocRecep></ns0:Receptor>
  <ns0:Totales><ns0:TpoMoneda>UYU</ns0:TpoMoneda><ns0:MntNetoIVATasaBasica>1000.00</ns0:MntNetoIVATasaBasica>
  <ns0:MntIVATasaBasica>220.00</ns0:MntIVATasaBasica><ns0:MntTotal>1220.00</ns0:MntTotal></ns0:Totales>
</ns0:Encabezado>${extra}</ns0:eFact></ns0:CFE>`;

const makePdf = (lines: string[]) =>
  new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    lines.forEach((line) => doc.text(line));
    doc.end();
  });

describe("parseAmount", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1234.5", 1234.5],
    ["1234,56", 1234.56],
    ["1.234", 1234],
    ["$ 12.345.678,90", 12_345_678.9],
  ])("%s → %d", (raw, expected) => expect(parseAmount(raw)).toBe(expected));

  it("returns null without digits", () => expect(parseAmount("abc")).toBeNull());
});

describe("parseDate", () => {
  it("reads local and ISO dates", () => {
    expect(parseDate("15/10/2026")).toBe("2026-10-15");
    expect(parseDate("5-1-26")).toBe("2026-01-05");
    expect(parseDate("2026-10-15")).toBe("2026-10-15");
    expect(parseDate("45/13/2026")).toBeNull();
  });
});

describe("parseCfeXml", () => {
  it("reads an e-Factura", () => {
    const doc = parseCfeXml(cfeXml(111));
    expect(doc).toMatchObject({
      type: "factura",
      cfeType: 111,
      series: "A",
      number: "1234",
      issueDate: "2026-10-15",
      clientName: "Hospital de Clínicas",
      clientRut: "210000000017",
      currency: "UYU",
      subtotal: 1000,
      tax: 220,
      total: 1220,
      needsReview: false,
    });
  });

  it("reads a credit note and the invoice it refers to", () => {
    const ref = "<ns0:Referencia><ns0:Referencia><ns0:Serie>A</ns0:Serie><ns0:NroCFERef>1200</ns0:NroCFERef></ns0:Referencia></ns0:Referencia>";
    const doc = parseCfeXml(cfeXml(112, ref));
    expect(doc.type).toBe("nota_credito");
    expect(doc.referenceNumber).toBe("A-1200");
  });

  it("rejects e-Remitos", () => {
    expect(() => parseCfeXml(cfeXml(181))).toThrow(NotABillingDocumentError);
  });
});

describe("parsePdfText", () => {
  it("reads an e-Factura PDF exported by the billing system", async () => {
    const pdf = await makePdf([
      "NC GROUP S.A.S.",
      `RUT ${COMPANY_RUT}`,
      "e-Factura",
      "Serie A Nro 0004567",
      "Fecha de emisión: 20/10/2026",
      "RUT Comprador 210000000017",
      "Razón social: ASSE - Hospital Maciel",
      "Moneda: USD",
      "Subtotal 1.000,00",
      "IVA Tasa Básica 220,00",
      "TOTAL A PAGAR 1.220,00",
    ]);
    const doc = parsePdfText(await readPdfText(pdf), "factura.pdf", COMPANY_RUT);
    expect(doc).toMatchObject({
      type: "factura",
      cfeType: 111,
      series: "A",
      number: "4567",
      issueDate: "2026-10-20",
      clientRut: "210000000017",
      clientName: "ASSE - Hospital Maciel",
      currency: "USD",
      subtotal: 1000,
      tax: 220,
      total: 1220,
      needsReview: false,
    });
  });

  it("detects credit notes by their title", () => {
    const doc = parsePdfText("Nota de Crédito de e-Factura\nSerie A Nro 15\nFecha 01/10/2026\nReferencia: Factura A 4567\nTotal $ 500,00", "doc.pdf");
    expect(doc.type).toBe("nota_credito");
    expect(doc.cfeType).toBe(112);
    expect(doc.number).toBe("15");
    expect(doc.referenceNumber).toBe("A-4567");
    expect(doc.total).toBe(500);
  });

  it("falls back to the file name and flags missing data for review", () => {
    const doc = parsePdfText("", "NC A-0000321.pdf");
    expect(doc.type).toBe("nota_credito");
    expect(doc.series).toBe("A");
    expect(doc.number).toBe("321");
    expect(doc.needsReview).toBe(true);
  });

  it("rejects e-Remitos", () => {
    expect(() => parsePdfText("e-Remito\nSerie A Nro 1", "remito.pdf")).toThrow(NotABillingDocumentError);
  });
});

describe("readPdfText", () => {
  it("reads the same PDF every time (pdf-parse 1.1.1 failed at random with 'bad XRef entry')", async () => {
    const pdf = await makePdf(["e-Factura", "Serie A Nro 0000101", "TOTAL A PAGAR 1.220,00"]);
    for (let i = 0; i < 5; i++) {
      const text = await readPdfText(pdf);
      expect(text).toContain("Serie A Nro 0000101");
      expect(text).toContain("TOTAL A PAGAR 1.220,00");
    }
  });

  it("keeps cells of the same row on one line", async () => {
    const pdf = await new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.text("TOTAL A PAGAR", 50, 300, { lineBreak: false });
      doc.text("1.220,00", 400, 300, { lineBreak: false });
      doc.text("Serie", 50, 100, { lineBreak: false });
      doc.text("A", 120, 100, { lineBreak: false });
      doc.end();
    });
    expect((await readPdfText(pdf)).split("\n")).toEqual(["Serie A", "TOTAL A PAGAR 1.220,00"]);
  });
});

/** A PDF with text at absolute positions (pdfkit: y grows downwards) */
const makeLayoutPdf = (texts: Array<[string, number, number]>) =>
  new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(9);
    texts.forEach(([text, x, y]) => doc.text(text, x, y, { lineBreak: false }));
    doc.end();
  });

describe("parsePdfText with the DGI box layout (label on top, value below)", () => {
  it("reads every field of an e-Factura printed in boxes", async () => {
    const pdf = await makeLayoutPdf([
      ["NC GROUP S.A.S.", 40, 40],
      ["RUC EMISOR", 380, 40],
      [COMPANY_RUT, 380, 52],
      ["TIPO DE CFE", 40, 100], ["SERIE", 160, 100], ["NÚMERO", 220, 100], ["FECHA DE EMISIÓN", 300, 100], ["MONEDA", 430, 100],
      ["e-Factura", 40, 114], ["A", 160, 114], ["0001234", 220, 114], ["29/10/2026", 300, 114], ["UYU", 430, 114],
      ["RUC COMPRADOR", 40, 150], ["NOMBRE O DENOMINACIÓN", 180, 150],
      ["21.000000.0017", 40, 164], ["Administración de los Servicios de Salud del Estado", 180, 164],
      ["Descripción", 40, 220], ["Cant.", 300, 220], ["Precio", 360, 220], ["Importe", 450, 220],
      ["Guantes de nitrilo talle M", 40, 236], ["100", 300, 236], ["50,00", 360, 236], ["5.000,00", 450, 236],
      ["Subtotal", 360, 400], ["5.000,00", 450, 400],
      ["IVA 22%", 360, 414], ["1.100,00", 450, 414],
      ["TOTAL A PAGAR", 360, 428], ["$ 6.100,00", 450, 428],
      ["Fecha de vencimiento", 40, 470], ["28/11/2026", 160, 470],
    ]);
    const { readPdf } = await import("../../../../src/contexts/billing/pdf-reader");
    const { text, cells } = await readPdf(pdf);
    const doc = parsePdfText(text, "CFE.pdf", COMPANY_RUT, cells);
    expect(doc).toMatchObject({
      type: "factura",
      cfeType: 111,
      series: "A",
      number: "1234",
      issueDate: "2026-10-29",
      clientRut: "210000000017",
      clientName: "Administración de los Servicios de Salud del Estado",
      currency: "UYU",
      total: 6100,
      needsReview: false,
    });
  });

  it("reads a credit note whose header is a single 'Serie - Número' box", async () => {
    const pdf = await makeLayoutPdf([
      ["Nota de Crédito de e-Factura", 40, 40],
      ["Serie - Número", 300, 40], ["B - 0000077", 300, 54],
      ["Fecha", 420, 40], ["02/10/2026", 420, 54],
      ["Moneda", 40, 90], ["Dólares", 40, 104],
      ["Total", 380, 300], ["US$ 450,50", 450, 300],
    ]);
    const { readPdf } = await import("../../../../src/contexts/billing/pdf-reader");
    const { text, cells } = await readPdf(pdf);
    expect(parsePdfText(text, "x.pdf", COMPANY_RUT, cells)).toMatchObject({
      type: "nota_credito",
      series: "B",
      number: "77",
      issueDate: "2026-10-02",
      currency: "USD",
      total: 450.5,
    });
  });
});
