import type PDFKit from "pdfkit";

// Colores del logo de NC Group (los mismos de la cotización)
const NAVY = "#1E2846";
const BLUE = "#0A6EB4";
const CYAN = "#50D2DC";
const INK = "#1F2633";
const MUTED = "#6B7385";
const LINE = "#D5DBE5";
const SOFT = "#F3F6FA";

const MARGIN = 36;

export const COMPANY = {
  name: "NC GROUP SAS",
  rut: "190323070010",
  address: "Calle 1 M2 S22, Pinamar – Canelones – Uruguay",
  phones: "095 604 331 – 091 960 280",
  emails: "ncgroup@ncgroup.com.uy  ·  ncgroup.importaciones@ncgroup.com.uy",
  footerAddress: "CALLE 1 M2 S22 PINAMAR – CANELONES – URUGUAY  |  TEL. 095 604 331 – 091 960 280",
};

export interface RemitoPdfItem {
  code?: string | null;
  description: string;
  quantity: number;
}

export interface RemitoPdfData {
  number: number;
  /** YYYY-MM-DD */
  date: string;
  receiverName: string;
  receiverRut?: string | null;
  receiverAddress?: string | null;
  receiverCity?: string | null;
  receiverPhone?: string | null;
  purchaseOrder?: string | null;
  reference?: string | null;
  notes?: string | null;
  cancelled?: boolean;
  items: RemitoPdfItem[];
}

interface Column {
  title: string;
  width: number;
  align: "left" | "center" | "right";
}

export function formatRemitoNumber(number: number): string {
  return String(number).padStart(6, "0");
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gradientBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number): void {
  const gradient = doc.linearGradient(x, y, x + width, y);
  gradient.stop(0, CYAN).stop(0.45, BLUE).stop(1, NAVY);
  doc.rect(x, y, width, height).fill(gradient);
}

/** Label/value rows inside a titled box; returns the box height used. */
function drawInfoBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: Array<[string, string]>,
  minHeight: number,
): number {
  const headerHeight = 20;
  const labelWidth = 74;
  const valueWidth = width - labelWidth - 20;

  let bodyHeight = 8;
  doc.font("Helvetica").fontSize(8.5);
  const rowHeights = rows.map(([, value]) => Math.max(15, doc.heightOfString(value || "—", { width: valueWidth }) + 5));
  bodyHeight += rowHeights.reduce((sum, h) => sum + h, 0) + 4;
  const height = Math.max(minHeight, headerHeight + bodyHeight);

  doc.roundedRect(x, y, width, height, 4).lineWidth(0.8).strokeColor(LINE).stroke();
  doc.save().roundedRect(x, y, width, headerHeight, 4).clip();
  doc.rect(x, y, width, headerHeight).fill(NAVY);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("white")
    .text(title, x + 10, y + 6.5, { characterSpacing: 1.2, lineBreak: false });

  let rowY = y + headerHeight + 8;
  rows.forEach(([label, value], index) => {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text(label, x + 10, rowY + 1.5, { width: labelWidth - 6, characterSpacing: 0.6, lineBreak: false });
    doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(index === 0 ? NAVY : INK)
      .text(value || "—", x + labelWidth + 10, rowY, { width: valueWidth });
    rowY += rowHeights[index];
  });
  return height;
}

function drawTableHeader(doc: PDFKit.PDFDocument, columns: Column[], y: number): number {
  const height = 22;
  const width = columns.reduce((sum, c) => sum + c.width, 0);
  doc.rect(MARGIN, y, width, height).fill(NAVY);
  let x = MARGIN;
  for (const col of columns) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("white")
      .text(col.title, x + 6, y + 7.5, { width: col.width - 12, align: col.align, characterSpacing: 0.8, lineBreak: false });
    x += col.width;
  }
  return y + height;
}

/** Remito de entrega (sin precios). Separado del servicio para poder probar el diseño sin NestJS. */
export function renderRemitoPdf(doc: PDFKit.PDFDocument, remito: RemitoPdfData, logo: Buffer | null): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - MARGIN * 2;
  const right = MARGIN + contentWidth;

  // === ENCABEZADO: empresa a la izquierda, número y fecha a la derecha ===
  if (logo) {
    doc.image(logo, MARGIN - 4, 24, { height: 78 });
  }
  const companyX = MARGIN + 110;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(COMPANY.name, companyX, 36, { characterSpacing: 0.5 });
  doc.font("Helvetica").fontSize(8).fillColor(INK)
    .text(`RUT ${COMPANY.rut}`, companyX, 52)
    .text(COMPANY.address, companyX, 63)
    .text(`Tel. ${COMPANY.phones}`, companyX, 74);
  doc.fillColor(MUTED).text("ncgroup@ncgroup.com.uy", companyX, 85);

  const boxWidth = 168;
  const boxX = right - boxWidth;
  doc.roundedRect(boxX, 26, boxWidth, 76, 5).lineWidth(1).strokeColor(NAVY).stroke();
  doc.save().roundedRect(boxX, 26, boxWidth, 26, 5).clip();
  doc.rect(boxX, 26, boxWidth, 26).fill(NAVY);
  doc.restore();
  doc.font("Helvetica-Bold").fontSize(14).fillColor("white")
    .text("REMITO", boxX, 32.5, { width: boxWidth, align: "center", characterSpacing: 4, lineBreak: false });
  doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("N.º", boxX + 12, 61, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(NAVY)
    .text(formatRemitoNumber(remito.number), boxX, 58, { width: boxWidth - 12, align: "right", characterSpacing: 1, lineBreak: false });
  doc.moveTo(boxX + 10, 80).lineTo(boxX + boxWidth - 10, 80).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("FECHA", boxX + 12, 87, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK)
    .text(formatDate(remito.date), boxX, 85.5, { width: boxWidth - 12, align: "right", lineBreak: false });

  gradientBar(doc, MARGIN, 116, contentWidth, 3.5);

  // === CLIENTE / ENTREGA ===
  let y = 132;
  const gap = 12;
  const leftWidth = contentWidth * 0.6 - gap / 2;
  const rightWidth = contentWidth - leftWidth - gap;
  const city = remito.receiverCity?.trim();
  const clientRows: Array<[string, string]> = [
    ["NOMBRE", remito.receiverName],
    ["RUT", remito.receiverRut || ""],
    ["DIRECCIÓN", [remito.receiverAddress, city].filter(Boolean).join(" – ")],
    ["TELÉFONO", remito.receiverPhone || ""],
  ];
  const deliveryRows: Array<[string, string]> = [
    ["ORDEN COMPRA", remito.purchaseOrder || ""],
    ["FECHA", formatDate(remito.date)],
    ["REFERENCIA", remito.reference || ""],
  ];
  const boxHeight = Math.max(
    drawInfoBox(doc, MARGIN, y, leftWidth, "CLIENTE", clientRows, 0),
    0,
  );
  const deliveryHeight = drawInfoBox(doc, MARGIN + leftWidth + gap, y, rightWidth, "DATOS DE LA ENTREGA", deliveryRows, boxHeight);
  if (deliveryHeight > boxHeight) {
    // Keep both boxes the same height
    doc.rect(MARGIN, y, leftWidth, deliveryHeight).fill("white");
    drawInfoBox(doc, MARGIN, y, leftWidth, "CLIENTE", clientRows, deliveryHeight);
  }
  y += Math.max(boxHeight, deliveryHeight) + 14;

  doc.font("Helvetica").fontSize(8.5).fillColor(INK)
    .text("Se deja constancia de la entrega de la siguiente mercadería:", MARGIN, y);
  y = doc.y + 8;

  // === TABLA DE ÍTEMS ===
  const columns: Column[] = [
    { title: "ÍTEM", width: 38, align: "center" },
    { title: "CÓDIGO", width: 100, align: "left" },
    { title: "DESCRIPCIÓN", width: contentWidth - 38 - 100 - 76, align: "left" },
    { title: "CANTIDAD", width: 76, align: "center" },
  ];
  const tableWidth = contentWidth;
  const signatureBlock = 190;
  const pageBottom = pageHeight - 70;
  y = drawTableHeader(doc, columns, y);

  remito.items.forEach((item, index) => {
    doc.font("Helvetica").fontSize(8.5);
    const rowHeight = Math.max(22, doc.heightOfString(item.description, { width: columns[2].width - 12 }) + 12);
    if (y + rowHeight > pageBottom) {
      doc.addPage();
      y = drawTableHeader(doc, columns, MARGIN);
    }
    if (index % 2 === 1) doc.rect(MARGIN, y, tableWidth, rowHeight).fill(SOFT);

    let x = MARGIN;
    const cells = [String(index + 1), item.code?.trim() || "—", item.description, formatQuantity(Number(item.quantity))];
    columns.forEach((col, colIndex) => {
      const isDescription = colIndex === 2;
      doc.font(colIndex === 3 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(INK);
      const textHeight = isDescription ? doc.heightOfString(cells[colIndex], { width: col.width - 12 }) : 8.5;
      doc.text(cells[colIndex], x + 6, y + (rowHeight - textHeight) / 2, {
        width: col.width - 12,
        align: col.align,
        lineBreak: isDescription,
      });
      x += col.width;
    });
    doc.moveTo(MARGIN, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.6).strokeColor(LINE).stroke();
    y += rowHeight;
  });

  // Totales de bultos/unidades
  const totalUnits = remito.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalWidth = 200;
  doc.rect(right - totalWidth, y, totalWidth, 22).fill(NAVY);
  doc.font("Helvetica-Bold").fontSize(8).fillColor("white")
    .text(`TOTAL: ${remito.items.length} ÍTEMS`, right - totalWidth + 10, y + 7.5, { lineBreak: false })
    .text(`${formatQuantity(totalUnits)} UNID.`, right - totalWidth, y + 7.5, { width: totalWidth - 10, align: "right", lineBreak: false });
  y += 34;

  // === OBSERVACIONES ===
  const notes = remito.notes?.trim();
  doc.font("Helvetica").fontSize(8.5);
  const notesHeight = notes ? Math.max(34, doc.heightOfString(notes, { width: contentWidth - 20 }) + 26) : 0;
  if (y + notesHeight + signatureBlock > pageBottom) {
    doc.addPage();
    y = MARGIN;
  }
  if (notes) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor(BLUE).text("OBSERVACIONES", MARGIN, y, { characterSpacing: 1.2 });
    const boxY = y + 11;
    const boxH = notesHeight - 11;
    doc.rect(MARGIN, boxY, contentWidth, boxH).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.rect(MARGIN, boxY, 2.5, boxH).fill(BLUE);
    doc.font("Helvetica").fontSize(8.5).fillColor(INK).text(notes, MARGIN + 12, boxY + 7, { width: contentWidth - 20 });
    y += notesHeight + 14;
  }

  // === FIRMAS: entrega y recepción conforme ===
  const signY = Math.max(y, pageBottom - signatureBlock + 30);
  const halfWidth = (contentWidth - 24) / 2;
  const blocks: Array<[string, number]> = [["ENTREGADO POR", MARGIN], ["RECIBÍ CONFORME", MARGIN + halfWidth + 24]];
  for (const [title, x] of blocks) {
    doc.roundedRect(x, signY, halfWidth, 130, 4).lineWidth(0.8).strokeColor(LINE).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY).text(title, x + 12, signY + 10, { characterSpacing: 1.2 });
    const fields = ["Firma", "Aclaración", "C.I.", "Fecha"];
    fields.forEach((field, i) => {
      const lineY = signY + 46 + i * 22;
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(field, x + 12, lineY - 9, { lineBreak: false });
      doc.moveTo(x + 66, lineY).lineTo(x + halfWidth - 12, lineY).lineWidth(0.6).strokeColor("#9AA3B5").stroke();
    });
  }

  // === ANULADO ===
  if (remito.cancelled) {
    doc.save();
    doc.rotate(-30, { origin: [pageWidth / 2, pageHeight / 2] });
    doc.font("Helvetica-Bold").fontSize(90).fillColor("#C0392B").fillOpacity(0.18)
      .text("ANULADO", 0, pageHeight / 2 - 50, { width: pageWidth, align: "center" });
    doc.restore();
  }

  // === PIE DE PÁGINA (en todas las páginas) ===
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    // The last footer line sits below the bottom margin; without this PDFKit adds a blank page
    doc.page.margins.bottom = 0;
    const footerY = pageHeight - 56;
    gradientBar(doc, MARGIN, footerY, contentWidth, 2.5);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
      .text(COMPANY.footerAddress, MARGIN, footerY + 9, { width: contentWidth, align: "center", lineBreak: false })
      .text(COMPANY.emails, MARGIN, footerY + 21, { width: contentWidth, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(`Remito N.º ${formatRemitoNumber(remito.number)}  ·  Hoja ${page - range.start + 1} / ${range.count}`,
        MARGIN, footerY + 33, { width: contentWidth, align: "center", lineBreak: false });
  }
}
