import type PDFKit from "pdfkit";

// NC Group logo colors, same as the quotation PDF
const NAVY = "#1E2846";
const BLUE = "#0A6EB4";
const CYAN = "#50D2DC";
const INK = "#1F2633";
const MUTED = "#6B7385";
const LINE = "#D5DBE5";
const SOFT = "#F3F6FA";
const GREEN = "#2F6B12";
const GREEN_BG = "#EAF3DE";
const AMBER = "#7A4A08";
const AMBER_BG = "#FAEEDA";
const BLUE_BG = "#E6F1FB";

const MARGIN = 40;
const COMPANY = { name: "NC GROUP SAS", rut: "190323070010" };

/** Partners and their share of the profit of every collection (must add up to 100) */
export const PROFIT_PARTNERS: ReadonlyArray<{ name: string; share: number }> = [
  { name: "NICOLAS CORNALINO", share: 33 },
  { name: "MIGUEL CORNALINO", share: 25 },
  { name: "GASTON MARIOTTINI", share: 25 },
  { name: "NICOLAS MARIOTTINI", share: 17 },
];

export interface CollectionPdfInvoice {
  /** "A-1203" */
  label: string;
  /** YYYY-MM-DD */
  issueDate: string | null;
  net: number;
  tax: number;
  total: number;
}

export interface CollectionPdfData {
  /** "CB-0001" */
  number: string;
  /** Date the transfer was received, YYYY-MM-DD */
  date: string;
  currency: string;
  clientName: string;
  clientRut: string | null;
  bank: string | null;
  reference: string | null;
  amountReceived: number;
  invoices: CollectionPdfInvoice[];
  /** Cost of the goods, without VAT */
  cost: number;
  /** VAT paid to the providers for those goods */
  purchaseTax: number;
  notes: string | null;
}

export interface CollectionTotals {
  net: number;
  salesTax: number;
  invoiced: number;
  profit: number;
  /** Profit over net sale, in %; null without sale */
  margin: number | null;
  /** Profit over cost, in %; null without cost */
  markup: number | null;
  taxToPay: number;
  /** Amount received minus the invoices total (bank fees, rounding) */
  difference: number;
  partners: Array<{ name: string; share: number; amount: number }>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Totals of a collection and the profit split among the partners (cents go to the first one) */
export function collectionTotals(data: Pick<CollectionPdfData, "invoices" | "cost" | "purchaseTax" | "amountReceived">): CollectionTotals {
  const net = round2(data.invoices.reduce((sum, i) => sum + i.net, 0));
  const salesTax = round2(data.invoices.reduce((sum, i) => sum + i.tax, 0));
  const invoiced = round2(data.invoices.reduce((sum, i) => sum + i.total, 0));
  const profit = round2(net - data.cost);
  const partners = PROFIT_PARTNERS.map((p) => ({ ...p, amount: round2((profit * p.share) / 100) }));
  const spread = round2(profit - partners.reduce((sum, p) => sum + p.amount, 0));
  if (partners.length && spread !== 0) partners[0].amount = round2(partners[0].amount + spread);
  return {
    net,
    salesTax,
    invoiced,
    profit,
    margin: net > 0 ? (profit / net) * 100 : null,
    markup: data.cost > 0 ? (profit / data.cost) * 100 : null,
    taxToPay: round2(salesTax - data.purchaseTax),
    difference: round2(data.amountReceived - invoiced),
    partners,
  };
}

const money = (value: number) =>
  value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

function gradientBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number): void {
  const gradient = doc.linearGradient(x, y, x + width, y);
  gradient.stop(0, CYAN).stop(0.45, BLUE).stop(1, NAVY);
  doc.rect(x, y, width, height).fill(gradient);
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string, y: number): number {
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLUE).text(text, MARGIN, y, { characterSpacing: 1.2 });
  return y + 14;
}

interface Column { label: string; width: number; align?: "left" | "right" }

/** Table with a navy header; returns the y under it */
function table(doc: PDFKit.PDFDocument, y: number, columns: Column[], rows: string[][], highlight: "first" | "last" | null = null): number {
  const rowHeight = 20;
  let x = MARGIN;
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  doc.rect(MARGIN, y, width, rowHeight).fill(NAVY);
  for (const c of columns) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("white")
      .text(c.label, x + 8, y + 6.5, { width: c.width - 16, align: c.align ?? "left" });
    x += c.width;
  }
  y += rowHeight;
  rows.forEach((row, index) => {
    const last = highlight === "last" ? index === rows.length - 1 : highlight === "first" && index === 0;
    if (last) doc.rect(MARGIN, y, width, rowHeight).fill(SOFT);
    x = MARGIN;
    row.forEach((cell, i) => {
      doc.font(last ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(last ? NAVY : INK)
        .text(cell, x + 8, y + 6, { width: columns[i].width - 16, align: columns[i].align ?? "left" });
      x += columns[i].width;
    });
    doc.moveTo(MARGIN, y + rowHeight).lineTo(MARGIN + width, y + rowHeight).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowHeight;
  });
  return y;
}

/** Label / value lines; the highlighted one in color and bold */
function summary(doc: PDFKit.PDFDocument, x: number, y: number, width: number, lines: Array<{ label: string; value: string; color?: string }>): number {
  for (const line of lines) {
    const font = line.color ? "Helvetica-Bold" : "Helvetica";
    doc.font(font).fontSize(9).fillColor(line.color ?? INK).text(line.label, x, y, { width: width * 0.6 });
    doc.font(font).fontSize(9).fillColor(line.color ?? INK).text(line.value, x + width * 0.4, y, { width: width * 0.6, align: "right" });
    y += 15;
    doc.moveTo(x, y - 3).lineTo(x + width, y - 3).lineWidth(0.5).strokeColor(LINE).stroke();
  }
  return y;
}

function tile(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, bg: string, color: string): void {
  doc.roundedRect(x, y, width, 44, 6).fill(bg);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(color).text(label, x + 10, y + 9, { characterSpacing: 1 });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(color).text(value, x + 10, y + 21, { width: width - 20 });
}

export function renderCollectionPdf(doc: PDFKit.PDFDocument, data: CollectionPdfData, assets: { logo?: Buffer | null }): void {
  const contentWidth = doc.page.width - MARGIN * 2;
  const totals = collectionTotals(data);
  const cur = data.currency;

  // === HEADER ===
  if (assets.logo) doc.image(assets.logo, MARGIN - 4, 26, { height: 80 });
  doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY)
    .text("COMPROBANTE DE COBRANZA", MARGIN, 38, { width: contentWidth, align: "right", characterSpacing: 1.5 });
  doc.font("Helvetica").fontSize(9).fillColor(INK)
    .text(`N° ${data.number} · ${day(data.date)}`, MARGIN, 62, { width: contentWidth, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY)
    .text(COMPANY.name, MARGIN, 78, { width: contentWidth, align: "right", characterSpacing: 0.5 });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(`RUT ${COMPANY.rut}`, MARGIN, 92, { width: contentWidth, align: "right" });
  gradientBar(doc, MARGIN, 116, contentWidth, 3.5);

  // === CLIENT AND TRANSFER ===
  let y = 134;
  const half = contentWidth / 2;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(BLUE).text("CLIENTE", MARGIN, y, { characterSpacing: 1.2 });
  doc.text("TRANSFERENCIA", MARGIN + half, y, { characterSpacing: 1.2 });
  y += 13;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(data.clientName, MARGIN, y, { width: half - 16 });
  doc.text([data.bank, data.reference ? `Ref. ${data.reference}` : null].filter(Boolean).join(" · ") || "—", MARGIN + half, y, { width: half });
  y += 15;
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(data.clientRut ? `RUT ${data.clientRut}` : "", MARGIN, y, { width: half - 16 });
  doc.text(`Recibida el ${day(data.date)} · ${cur} ${money(data.amountReceived)}`, MARGIN + half, y, { width: half });
  y += 28;

  // === INVOICES ===
  y = sectionTitle(doc, "FACTURAS CANCELADAS", y);
  const w = contentWidth;
  y = table(
    doc,
    y,
    [
      { label: "Factura", width: w * 0.24 },
      { label: "Fecha", width: w * 0.16 },
      { label: "Neto", width: w * 0.2, align: "right" },
      { label: "IVA", width: w * 0.18, align: "right" },
      { label: "Total", width: w * 0.22, align: "right" },
    ],
    [
      ...data.invoices.map((i) => [i.label, day(i.issueDate), money(i.net), money(i.tax), money(i.total)]),
      [`Total ${cur}`, "", money(totals.net), money(totals.salesTax), money(totals.invoiced)],
    ],
    "last",
  );
  y += 22;

  // === RESULT ===
  y = sectionTitle(doc, "RESULTADO DE LA COBRANZA", y);
  const colWidth = (contentWidth - 24) / 2;
  const left = summary(doc, MARGIN, y, colWidth, [
    { label: "Venta neta (sin IVA)", value: money(totals.net) },
    { label: "Costo de mercadería", value: `-${money(data.cost)}` },
    { label: "Ganancia", value: money(totals.profit), color: GREEN },
    { label: "Margen · Markup", value: `${pct(totals.margin)} · ${pct(totals.markup)}` },
  ]);
  const right = summary(doc, MARGIN + colWidth + 24, y, colWidth, [
    { label: "IVA ventas", value: money(totals.salesTax) },
    { label: "IVA compras", value: `-${money(data.purchaseTax)}` },
    { label: "IVA a pagar", value: money(totals.taxToPay), color: AMBER },
    { label: "Diferencia de cobro", value: money(totals.difference) },
  ]);
  y = Math.max(left, right) + 12;

  const tileWidth = (contentWidth - 20) / 3;
  tile(doc, MARGIN, y, tileWidth, "GANANCIA", `${cur} ${money(totals.profit)}`, GREEN_BG, GREEN);
  tile(doc, MARGIN + tileWidth + 10, y, tileWidth, "MARGEN", pct(totals.margin), AMBER_BG, AMBER);
  tile(doc, MARGIN + (tileWidth + 10) * 2, y, tileWidth, "COBRADO", `${cur} ${money(data.amountReceived)}`, BLUE_BG, NAVY);
  y += 66;

  // === PROFIT SPLIT ===
  y = sectionTitle(doc, "REPARTO DE LA GANANCIA", y);
  y = table(
    doc,
    y,
    [
      { label: "Socio", width: w * 0.5 },
      { label: "Porcentaje", width: w * 0.2, align: "right" },
      { label: `Importe ${cur}`, width: w * 0.3, align: "right" },
    ],
    [
      ["TOTAL GANANCIA", "100 %", money(totals.profit)],
      ...totals.partners.map((p) => [p.name, `${p.share} %`, money(p.amount)]),
    ],
    "first",
  );

  if (data.notes) {
    y += 16;
    y = sectionTitle(doc, "NOTAS", y);
    doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(data.notes, MARGIN, y, { width: contentWidth });
  }

  // === FOOTER ===
  const footerY = doc.page.height - 46;
  doc.moveTo(MARGIN, footerY).lineTo(MARGIN + contentWidth, footerY).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
    .text(
      `Documento interno de control · no es un comprobante fiscal · generado el ${new Date().toLocaleDateString("es-UY", { timeZone: "America/Montevideo", day: "2-digit", month: "2-digit", year: "numeric" })}`,
      MARGIN,
      footerY + 8,
      { width: contentWidth, align: "center", lineBreak: false },
    );
}
