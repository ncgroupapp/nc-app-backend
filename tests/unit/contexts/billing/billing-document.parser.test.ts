import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import {
  NotABillingDocumentError,
  parseAmount,
  parseCfeXml,
  parseDate,
  parsePdfText,
} from "../../../../src/contexts/billing/billing-document.parser";
import { pdfToText } from "../../../../src/contexts/solicitudes/pdf-text";

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
    const doc = parsePdfText(await pdfToText(pdf), "factura.pdf", COMPANY_RUT);
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
