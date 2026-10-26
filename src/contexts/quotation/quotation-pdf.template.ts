import type PDFKit from "pdfkit";
import { QuotationAwardStatus } from "./entities/quotation.entity";
import type { Quotation, QuotationItem } from "./entities/quotation.entity";

// Colores del logo de NC Group
const NAVY = "#1E2846";
const BLUE = "#0A6EB4";
const CYAN = "#50D2DC";
const INK = "#1F2633";
const MUTED = "#6B7385";
const LINE = "#D5DBE5";
const SOFT = "#F3F6FA";
const HEADER_SUB = "#B9D4EE";

const MARGIN = 36;
const TIME_ZONE = "America/Montevideo";

const CURRENCY_NAMES: Record<string, string> = {
  USD: "USD – Dólares Americanos",
  UYU: "UYU – Pesos Uruguayos",
  EUR: "EUR – Euros",
  BRL: "BRL – Reales",
  ARS: "ARS – Pesos Argentinos",
  CLP: "CLP – Pesos Chilenos",
};

const COMPANY = {
  name: "NC GROUP SAS",
  rut: "190323070010",
  signer: "Director Nicolás Cornalino",
  signerContact: "NC GROUP SAS · Cel. 095 604 331",
  address: "CALLE 1 M2 S22 PINAMAR – CANELONES – URUGUAY  |  TEL. 095 604 331 – 091 960 280",
  emails: "ncgroup@ncgroup.com.uy  ·  ncgroup.importaciones@ncgroup.com.uy",
};

export interface QuotationPdfAssets {
  logo?: Buffer | null;
  signature?: Buffer | null;
}

interface Column {
  title: string;
  subtitle?: string;
  width: number;
  align: "left" | "center" | "right";
}

const COLUMNS: Column[] = [
  { title: "ÍTEM", width: 22, align: "center" },
  { title: "CÓDIGO", width: 66, align: "center" },
  { title: "CANT.", width: 28, align: "center" },
  { title: "DETALLE", width: 138, align: "left" },
  { title: "P/UNIT.", subtitle: "S/IVA", width: 53, align: "right" },
  { title: "P/UNIT.", subtitle: "C/IVA", width: 53, align: "right" },
  { title: "TOTAL", subtitle: "C/IVA", width: 59, align: "right" },
  { title: "ENTREGA", subtitle: "DÍAS HÁB.", width: 38, align: "center" },
  { title: "MARCA", subtitle: "ORIGEN", width: 66, align: "center" },
];

function formatAmount(value: number): string {
  return value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TIME_ZONE });
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
}

function unitPriceWithoutIva(item: QuotationItem): number {
  return item.awardStatus === QuotationAwardStatus.NOT_AWARDED
    ? Number(item.competitorInfo?.winnerPrice || 0)
    : Number(item.priceWithoutIVA);
}

function unitPriceWithIva(item: QuotationItem): number {
  return item.awardStatus === QuotationAwardStatus.NOT_AWARDED
    ? Number(item.competitorInfo?.winnerPrice || 0)
    : Number(item.priceWithIVA);
}

function gradientBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number): void {
  const gradient = doc.linearGradient(x, y, x + width, y);
  gradient.stop(0, CYAN).stop(0.45, BLUE).stop(1, NAVY);
  doc.rect(x, y, width, height).fill(gradient);
}

/** Alto que ocupa un texto principal con una segunda línea gris opcional debajo. */
function stackedHeight(doc: PDFKit.PDFDocument, main: string, sub: string, width: number, mainSize: number): number {
  doc.font("Helvetica").fontSize(mainSize);
  let height = doc.heightOfString(main, { width });
  if (sub) {
    doc.fontSize(6.5);
    height += doc.heightOfString(sub, { width }) + 1;
  }
  return height;
}

/** Texto principal con una segunda línea gris debajo, centrado verticalmente en la celda. */
function drawStackedCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  main: string,
  sub: string,
  align: "left" | "center",
  mainSize: number,
): void {
  const mainHeight = stackedHeight(doc, main, "", width, mainSize);
  const top = y + (height - stackedHeight(doc, main, sub, width, mainSize)) / 2;
  doc.font("Helvetica").fontSize(mainSize).fillColor(INK).text(main, x, top, { width, align });
  if (sub) {
    doc.fontSize(6.5).fillColor(MUTED).text(sub, x, top + mainHeight + 1, { width, align });
  }
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const height = 26;
  let x = MARGIN;
  doc.rect(MARGIN, y, COLUMNS.reduce((sum, c) => sum + c.width, 0), height).fill(NAVY);
  for (const col of COLUMNS) {
    const titleY = col.subtitle ? y + 6 : y + 10;
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("white")
      .text(col.title, x + 2, titleY, { width: col.width - 4, align: "center", lineBreak: false });
    if (col.subtitle) {
      doc.font("Helvetica").fontSize(5.8).fillColor(HEADER_SUB)
        .text(col.subtitle, x + 2, y + 15, { width: col.width - 4, align: "center", lineBreak: false });
    }
    x += col.width;
  }
  return y + height;
}

/**
 * Dibuja la cotización completa sobre el documento.
 * Separado del servicio para poder probar el diseño sin levantar NestJS.
 */
export function renderQuotationPdf(doc: PDFKit.PDFDocument, quotation: Quotation, assets: QuotationPdfAssets): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - MARGIN * 2;
  const right = MARGIN + contentWidth;

  const items = quotation.items || [];
  const currency = items[0]?.currency || "UYU";
  const licitation = quotation.licitation;
  const client = licitation?.client;
  const quoteDate = new Date(quotation.quotationDate || quotation.createdAt || Date.now());

  // === ENCABEZADO ===
  if (assets.logo) {
    doc.image(assets.logo, MARGIN - 4, 26, { height: 88 });
  }

  doc.font("Helvetica-Bold").fontSize(20).fillColor(NAVY)
    .text("COTIZACIÓN", MARGIN, 40, { width: contentWidth, align: "right", characterSpacing: 3 });
  doc.font("Helvetica").fontSize(9).fillColor(INK)
    .text(`Montevideo, ${formatLongDate(quoteDate)}`, MARGIN, 70, { width: contentWidth, align: "right" });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY)
    .text(COMPANY.name, MARGIN, 85, { width: contentWidth, align: "right", characterSpacing: 0.5 });
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
    .text(`RUT ${COMPANY.rut}`, MARGIN, 99, { width: contentWidth, align: "right" });

  gradientBar(doc, MARGIN, 124, contentWidth, 3.5);

  // === CLIENTE ===
  let y = 142;
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BLUE)
    .text("SEÑORES", MARGIN, y, { characterSpacing: 1.2 });
  y += 11;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
    .text(client?.name || quotation.clientName || "-", MARGIN, y, { width: contentWidth });
  y = doc.y + 2;
  const clientLines = [
    client?.identifier ? `RUT ${client.identifier}` : null,
    client?.contacts?.find(c => c.address)?.address || null,
  ].filter((line): line is string => Boolean(line));
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  for (const line of clientLines) {
    doc.text(line, MARGIN, y, { width: contentWidth });
    y = doc.y + 1;
  }

  // === SALUDO ===
  y += 14;
  doc.font("Helvetica").fontSize(9).fillColor(INK)
    .text("De nuestra consideración:", MARGIN, y)
    .text("En atención a lo solicitado, tenemos el agrado de cotizar lo siguiente:", MARGIN, doc.y + 2);

  // === COMPRA / APERTURA ===
  y = doc.y + 14;
  const infoHeight = 20;
  const labelWidth = contentWidth * 0.15;
  const valueWidth = contentWidth * 0.35;
  const purchase = licitation?.callNumber || quotation.associatedPurchase || "-";
  const opening = licitation?.deadlineDate
    ? `${formatShortDate(new Date(licitation.deadlineDate))} · ${formatTime(new Date(licitation.deadlineDate))} hs`
    : "-";
  const infoCells: Array<[string, string]> = [["COMPRA", purchase], ["APERTURA", opening]];
  let x = MARGIN;
  for (const [label, value] of infoCells) {
    doc.rect(x, y, labelWidth, infoHeight).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("white")
      .text(label, x + 8, y + 6.5, { characterSpacing: 0.8, lineBreak: false });
    doc.rect(x + labelWidth, y, valueWidth, infoHeight).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(INK)
      .text(value, x + labelWidth + 8, y + 6, { width: valueWidth - 16, lineBreak: false });
    x += labelWidth + valueWidth;
  }

  // === TABLA DE ÍTEMS ===
  y = drawTableHeader(doc, y + infoHeight + 10);
  const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const pageBottom = pageHeight - 80;

  items.forEach((item, index) => {
    const product = item.product;
    const detailSub = [product?.brand, product?.model].filter(Boolean).join(" ").trim();
    const brandText = item.brand || "-";
    const originText = item.origin || "";
    const rowHeight = Math.max(
      24,
      stackedHeight(doc, item.productName, detailSub, COLUMNS[3].width - 8, 7.5) + 10,
      stackedHeight(doc, brandText, originText, COLUMNS[8].width - 4, 7) + 10,
    );

    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = drawTableHeader(doc, MARGIN);
    }

    if (index % 2 === 1) {
      doc.rect(MARGIN, y, tableWidth, rowHeight).fill(SOFT);
    }

    const quantity = Number(item.quantity);
    const unitWithIva = unitPriceWithIva(item);
    const cells: string[] = [
      String(index + 1),
      product?.code?.trim() || "-",
      Number.isInteger(quantity) ? String(quantity) : formatAmount(quantity),
      "",
      `${currency} ${formatAmount(unitPriceWithoutIva(item))}`,
      `${currency} ${formatAmount(unitWithIva)}`,
      `${currency} ${formatAmount(unitWithIva * quantity)}`,
      item.deliveryTime != null && item.deliveryTime > 0 ? String(item.deliveryTime) : "-",
      "",
    ];

    let cellX = MARGIN;
    COLUMNS.forEach((col, colIndex) => {
      const isTotal = colIndex === 6;
      if (colIndex === 3) {
        drawStackedCell(doc, cellX + 4, y, col.width - 8, rowHeight, item.productName, detailSub, "left", 7.5);
      } else if (colIndex === 8) {
        drawStackedCell(doc, cellX + 2, y, col.width - 4, rowHeight, brandText, originText, "center", 7);
      } else {
        doc.font(isTotal ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor(INK)
          .text(cells[colIndex], cellX + 3, y + (rowHeight - 7.5) / 2, { width: col.width - 6, align: col.align, lineBreak: false });
      }
      doc.rect(cellX, y, col.width, rowHeight).lineWidth(0.6).strokeColor(LINE).stroke();
      cellX += col.width;
    });

    y += rowHeight;
  });

  // === CONDICIONES Y TOTALES ===
  const subtotal = items.reduce((acc, item) => acc + unitPriceWithoutIva(item) * Number(item.quantity), 0);
  const total = items.reduce((acc, item) => acc + unitPriceWithIva(item) * Number(item.quantity), 0);
  const ivaRates = [...new Set(items.map(item => Number(item.ivaPercentage)))];
  const ivaLabel = ivaRates.length === 1 ? `IVA ${formatAmount(ivaRates[0]).replace(/,00$/, "")}%` : "IVA";
  const deliveryDays = Math.max(0, ...items.map(item => Number(item.deliveryTime || 0)));

  const conditions: Array<[string, string]> = [
    ["Moneda cotizada", CURRENCY_NAMES[currency] || currency],
    ["Forma de pago", quotation.paymentForm || "-"],
    ["Validez de la oferta", quotation.validity || "-"],
  ];
  if (deliveryDays > 0) {
    conditions.push(["Plazo de entrega", `${deliveryDays} días hábiles`]);
  }

  const blockHeight = conditions.length * 20 + 150;
  if (y + 14 + blockHeight > pageHeight - 70) {
    doc.addPage();
    y = MARGIN;
  } else {
    y += 14;
  }

  const condLabelWidth = 115;
  const condWidth = 300;
  conditions.forEach(([label, value], i) => {
    const rowY = y + i * 20;
    doc.rect(MARGIN, rowY, condLabelWidth, 20).fill(SOFT);
    doc.rect(MARGIN, rowY, condLabelWidth, 20).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.rect(MARGIN + condLabelWidth, rowY, condWidth - condLabelWidth, 20).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY).text(label, MARGIN + 8, rowY + 6.5, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(INK)
      .text(value, MARGIN + condLabelWidth + 8, rowY + 6, { width: condWidth - condLabelWidth - 16, lineBreak: false });
  });

  const totalsWidth = 190;
  const totalsX = right - totalsWidth;
  const totalRows: Array<[string, number]> = [["Subtotal", subtotal], [ivaLabel, total - subtotal]];
  totalRows.forEach(([label, value], i) => {
    const rowY = y + i * 22;
    doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(label, totalsX + 8, rowY + 7, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK)
      .text(`${currency} ${formatAmount(value)}`, totalsX, rowY + 7, { width: totalsWidth - 8, align: "right", lineBreak: false });
    doc.moveTo(totalsX, rowY + 22).lineTo(right, rowY + 22).lineWidth(0.6).strokeColor(LINE).stroke();
  });
  const totalY = y + 46;
  doc.rect(totalsX, totalY, totalsWidth, 28).fill(NAVY);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("white").text("TOTAL", totalsX + 10, totalY + 9, { lineBreak: false });
  doc.fontSize(12).text(`${currency} ${formatAmount(total)}`, totalsX, totalY + 8.5, { width: totalsWidth - 10, align: "right", lineBreak: false });

  // === OBSERVACIONES ===
  y = Math.max(y + conditions.length * 20, totalY + 28) + 16;
  doc.font("Helvetica-Bold").fontSize(7).fillColor(BLUE).text("OBSERVACIONES", MARGIN, y, { characterSpacing: 1.2 });
  y += 11;
  const observations = quotation.observations?.trim() || "—";
  doc.font("Helvetica").fontSize(8.5);
  const obsHeight = Math.max(36, doc.heightOfString(observations, { width: contentWidth - 20 }) + 16);
  doc.rect(MARGIN, y, contentWidth, obsHeight).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.rect(MARGIN, y, 2.5, obsHeight).fill(BLUE);
  doc.fillColor(MUTED).text(observations, MARGIN + 12, y + 8, { width: contentWidth - 20 });

  // === FIRMA ===
  y += obsHeight + 24;
  doc.font("Helvetica").fontSize(9).fillColor(INK).text("Atentamente,", MARGIN, y);
  y = doc.y + 4;
  const signatureLineWidth = 175;
  if (assets.signature) {
    doc.image(assets.signature, MARGIN + 30, y, { height: 62 });
    y += 58;
  } else {
    y += 30;
  }
  doc.moveTo(MARGIN, y).lineTo(MARGIN + signatureLineWidth, y).lineWidth(0.8).strokeColor(INK).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(COMPANY.signer, MARGIN, y + 5);
  doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(COMPANY.signerContact, MARGIN, doc.y + 2);

  // === PIE DE PÁGINA (en todas las páginas) ===
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    const footerY = pageHeight - 52;
    gradientBar(doc, MARGIN, footerY, contentWidth, 2.5);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
      .text(COMPANY.address, MARGIN, footerY + 9, { width: contentWidth, align: "center", lineBreak: false })
      .text(COMPANY.emails, MARGIN, footerY + 21, { width: contentWidth, align: "center", lineBreak: false });
  }
}
