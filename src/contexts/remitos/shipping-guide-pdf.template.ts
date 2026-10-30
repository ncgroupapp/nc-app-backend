import type PDFKit from "pdfkit";
import { COMPANY } from "./remito-pdf.template";

const NAVY = "#1E2846";
const NAVY_DEEP = "#141B33";
const BLUE = "#0A6EB4";
const CYAN = "#50D2DC";
const INK = "#1F2633";
const MUTED = "#6B7385";
const RULE = "#C3CBDA";
const SOFT = "#F1F6FC";
const CUT = "#A9B3C6";

export interface ShippingGuidePdfData {
  recipientName: string;
  recipientPhone?: string | null;
  addressLines: string[];
  senderName: string;
  senderPhone?: string | null;
  senderRut?: string | null;
}

export interface ShippingGuideAssets {
  /** Logo for dark backgrounds (white letters). */
  logoWhite?: Buffer | null;
  logo?: Buffer | null;
}

// ===== Icons (vector shapes; PDFKit has no icon font) =====

function iconBadge(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, fill: string): void {
  doc.circle(cx, cy, r).fill(fill);
}

function pinIcon(doc: PDFKit.PDFDocument, x: number, y: number, color: string): void {
  doc.save().lineWidth(1.3).strokeColor(color);
  doc.circle(x, y - 1.5, 3.8).stroke();
  doc.moveTo(x - 3.3, y + 0.5).lineTo(x, y + 5.5).lineTo(x + 3.3, y + 0.5).stroke();
  doc.circle(x, y - 1.5, 1.2).fill(color);
  doc.restore();
}

function phoneIcon(doc: PDFKit.PDFDocument, x: number, y: number, color: string): void {
  doc.save().lineWidth(1.2).strokeColor(color);
  doc.roundedRect(x - 3.2, y - 5.2, 6.4, 10.4, 1.4).stroke();
  doc.moveTo(x - 1.2, y + 3.2).lineTo(x + 1.2, y + 3.2).stroke();
  doc.restore();
}

function boxIcon(doc: PDFKit.PDFDocument, x: number, y: number, color: string): void {
  doc.save().lineWidth(1.2).strokeColor(color).lineJoin("round");
  doc.polygon([x, y - 5], [x + 5, y - 2.5], [x + 5, y + 3], [x, y + 5.5], [x - 5, y + 3], [x - 5, y - 2.5]).stroke();
  doc.moveTo(x - 5, y - 2.5).lineTo(x, y).lineTo(x + 5, y - 2.5).stroke();
  doc.moveTo(x, y).lineTo(x, y + 5.5).stroke();
  doc.restore();
}

function gradient(doc: PDFKit.PDFDocument, x: number, y: number, width: number) {
  const g = doc.linearGradient(x, y, x + width, y);
  g.stop(0, CYAN).stop(0.5, BLUE).stop(1, NAVY);
  return g;
}

/** Section title: icon in a round badge + spaced caption + thin rule to the right edge. */
function sectionTitle(
  doc: PDFKit.PDFDocument,
  left: number,
  right: number,
  y: number,
  kicker: string,
  title: string,
  icon: (doc: PDFKit.PDFDocument, x: number, y: number, color: string) => void,
  badgeColor: string,
): void {
  iconBadge(doc, left + 11, y + 11, 11, badgeColor);
  icon(doc, left + 11, y + 11, "white");
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(BLUE)
    .text(kicker, left + 30, y + 2, { characterSpacing: 2, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY)
    .text(title, left + 30, y + 10, { characterSpacing: 1.5, lineBreak: false });
  const ruleX = left + 30 + doc.widthOfString(title, { characterSpacing: 1.5 }) + 10;
  doc.moveTo(ruleX, y + 16).lineTo(right, y + 16).lineWidth(0.8).strokeColor(RULE).stroke();
}

function drawLabel(
  doc: PDFKit.PDFDocument,
  guide: ShippingGuidePdfData,
  left: number,
  top: number,
  width: number,
  height: number,
  assets: ShippingGuideAssets,
): void {
  const right = left + width;
  const bottom = top + height;
  const radius = 12;
  const pad = 20;

  doc.save();
  doc.roundedRect(left, top, width, height, radius).clip();
  doc.rect(left, top, width, height).fill("white");

  // === CABECERA: banda oscura con formas diagonales ===
  const headerH = 112;
  doc.rect(left, top, width, headerH).fill(NAVY);
  doc.save();
  doc.polygon([right - 150, top], [right, top], [right, top + headerH], [right - 70, top + headerH]).fillOpacity(0.55).fill(BLUE);
  doc.polygon([right - 70, top], [right, top], [right, top + 60]).fillOpacity(0.7).fill(CYAN);
  doc.polygon([left, top + headerH - 34], [left + 120, top + headerH], [left, top + headerH]).fillOpacity(0.35).fill(NAVY_DEEP);
  doc.restore();
  doc.rect(left, top + headerH, width, 5).fill(gradient(doc, left, top + headerH, width));

  const logo = assets.logoWhite ?? assets.logo;
  if (logo) doc.image(logo, left + pad - 4, top + 20, { height: 64 });
  const titleRight = right - pad;
  doc.font("Helvetica-Bold").fontSize(7).fillColor("white")
    .text("NC GROUP SAS", left, top + 30, { width: titleRight - left, align: "right", characterSpacing: 3, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(23).fillColor("white")
    .text("DATOS DE ENVÍO", left, top + 42, { width: titleRight - left, align: "right", lineBreak: false });
  // Pill under the title
  doc.font("Helvetica-Bold").fontSize(6.5);
  const pillText = "PAQUETE NC GROUP";
  const pillW = doc.widthOfString(pillText, { characterSpacing: 1.5 }) + 18;
  doc.roundedRect(titleRight - pillW, top + 72, pillW, 15, 7.5).fill(CYAN);
  doc.fillColor(NAVY).text(pillText, titleRight - pillW, top + 76.5, { width: pillW, align: "center", characterSpacing: 1.5, lineBreak: false });

  // === PARA: DESTINATARIO ===
  let y = top + headerH + 22;
  sectionTitle(doc, left + pad, right - pad, y, "PARA", "DESTINATARIO", pinIcon, BLUE);
  y += 32;

  const cardX = left + pad;
  const cardW = width - pad * 2;
  const innerX = cardX + 18;
  const innerW = cardW - 30;

  doc.font("Helvetica-Bold").fontSize(17);
  const name = guide.recipientName || " ";
  const nameH = doc.heightOfString(name, { width: innerW, lineGap: 1 });
  const lines = guide.addressLines.slice(0, 3);
  const addressRows = Math.max(lines.length + 1, 3);
  const cardH = 16 + 9 + nameH + 14 + 22 + 12 + 9 + addressRows * 22 + 6;

  doc.roundedRect(cardX, y, cardW, cardH, 8).fill(SOFT);
  doc.save().roundedRect(cardX, y, cardW, cardH, 8).clip();
  const accent = doc.linearGradient(cardX, y, cardX, y + cardH);
  accent.stop(0, CYAN).stop(1, BLUE);
  doc.rect(cardX, y, 5, cardH).fill(accent);
  doc.restore();

  let cy = y + 16;
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("NOMBRE", innerX, cy, { characterSpacing: 1.5, lineBreak: false });
  cy += 9;
  doc.font("Helvetica-Bold").fontSize(17).fillColor(NAVY).text(name, innerX, cy, { width: innerW, lineGap: 1 });
  cy += nameH + 14;

  // Teléfono destacado
  iconBadge(doc, innerX + 9, cy + 9, 9, NAVY);
  phoneIcon(doc, innerX + 9, cy + 9, "white");
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK)
    .text(guide.recipientPhone || "—", innerX + 26, cy + 2.5, { width: innerW - 26, lineBreak: false, characterSpacing: 0.5 });
  cy += 22 + 12;

  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("DIRECCIÓN", innerX, cy, { characterSpacing: 1.5, lineBreak: false });
  cy += 9;
  for (let i = 0; i < addressRows; i++) {
    const line = lines[i] ?? "";
    doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text(line, innerX, cy + 3, { width: innerW, lineBreak: false, ellipsis: true });
    doc.moveTo(innerX, cy + 19).lineTo(innerX + innerW, cy + 19).lineWidth(0.7).strokeColor(RULE).stroke();
    cy += 22;
  }
  y += cardH + 18;

  // === DE: REMITENTE ===
  sectionTitle(doc, left + pad, right - pad, y, "DE", "REMITENTE", boxIcon, NAVY);
  y += 30;
  const senderCells: Array<[string, string]> = [
    ["NOMBRE", guide.senderName],
    ["TELÉFONO", guide.senderPhone || "—"],
    ["RUT", guide.senderRut || "—"],
  ];
  const cellW = cardW / 3;
  doc.roundedRect(cardX, y, cardW, 40, 8).lineWidth(0.9).strokeColor(RULE).stroke();
  senderCells.forEach(([label, value], i) => {
    const x = cardX + i * cellW;
    if (i > 0) doc.moveTo(x, y + 8).lineTo(x, y + 32).lineWidth(0.7).strokeColor(RULE).stroke();
    doc.font("Helvetica-Bold").fontSize(6).fillColor(MUTED)
      .text(label, x + 10, y + 9, { width: cellW - 16, characterSpacing: 1.2, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY)
      .text(value, x + 10, y + 20, { width: cellW - 16, lineBreak: false, ellipsis: true });
  });

  // === PIE: banda con agradecimiento y contacto ===
  const footerH = 72;
  const footerY = bottom - footerH;

  doc.rect(left, footerY, width, footerH).fill(NAVY);
  doc.rect(left, footerY, width, 4).fill(gradient(doc, left, footerY, width));
  doc.font("Helvetica-Bold").fontSize(10).fillColor("white")
    .text("¡GRACIAS POR ELEGIRNOS!", left, footerY + 14, { width, align: "center", characterSpacing: 2, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(8).fillColor("white")
    .text(COMPANY.footerAddress, left, footerY + 33, { width, align: "center", lineBreak: false })
    .text(COMPANY.emails, left, footerY + 47, { width, align: "center", lineBreak: false });

  doc.restore();
  // Card outline on top of the clipped content
  doc.roundedRect(left, top, width, height, radius).lineWidth(0.8).strokeColor(NAVY).stroke();
}

/** Guías de envío: dos por hoja A4 horizontal, con línea de corte al medio. */
export function renderShippingGuidesPdf(doc: PDFKit.PDFDocument, guides: ShippingGuidePdfData[], assets: ShippingGuideAssets): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginX = 22;
  const marginY = 20;
  const half = pageWidth / 2;
  const labelWidth = half - marginX * 2;
  const labelHeight = pageHeight - marginY * 2;

  guides.forEach((guide, index) => {
    const slot = index % 2;
    if (index > 0 && slot === 0) doc.addPage();
    if (slot === 0) {
      // Cut line between the two labels
      doc.save().moveTo(half, 8).lineTo(half, pageHeight - 8).dash(3, { space: 3 }).lineWidth(0.6).strokeColor(CUT).stroke().undash().restore();
    }
    drawLabel(doc, guide, slot * half + marginX, marginY, labelWidth, labelHeight, assets);
  });
}
