import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Quotation, QuotationAwardStatus } from './entities/quotation.entity';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class QuotationPdfService {
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
          margins: { top: 35, bottom: 50, left: 35, right: 35 },
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

        const pageWidth = 595.28;
        const centerX = pageWidth / 2;
        const contentX = 35;
        const contentWidth = pageWidth - 70;

        // === HEADER ===
        const headerY = 10;

        // Logo
        try {
          const logoPath = join(process.cwd(), 'assets', 'logo.png');
          const logoBuffer = readFileSync(logoPath);
          doc.image(logoBuffer, contentX, headerY, { width: 65 });
        } catch (logoError) {
          // Continuar sin logo si no se encuentra
        }

        // Título y número centrados
        doc
          .fontSize(18)
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .text('COTIZACIÓN', centerX, headerY + 8, { align: 'center' });

        doc
          .fontSize(11)
          .fillColor('#666666')
          .text(quotation.quotationIdentifier, centerX, headerY + 30, { align: 'center' });

        // Línea decorativa
        doc
          .moveTo(contentX, headerY + 45)
          .lineTo(contentX + contentWidth, headerY + 45)
          .strokeColor('#e0e0e0')
          .lineWidth(1)
          .stroke();

        // === INFO CLIENTE ===
        const infoY = headerY + 55;

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('CLIENTE:', contentX, infoY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(quotation.clientName || 'N/A', contentX + 45, infoY, { width: 250 });

        // === INFO FECHA ===
        const dateInfoY = infoY + 22;
        const quoteDate = quotation.quotationDate || quotation.createdAt;
        const dateStr = quoteDate
          ? new Date(quoteDate).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Montevideo' })
          : new Date().toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Montevideo' });

        // Formato 24h para la hora (sin p.m./a.m.)
        const timeStr = quoteDate
          ? new Date(quoteDate).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Montevideo' })
          : '';

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('FECHA:', contentX, dateInfoY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(dateStr, contentX + 45, dateInfoY, { width: 150 });

        // === IMM, APERT, HORA ===
        const immInfoY = dateInfoY + 22;

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('IMM:', contentX, immInfoY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(quotation.clientName || 'N/A', contentX + 45, immInfoY, { width: 200 });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('APERT:', contentX + 260, immInfoY);

        // APERT usa validUntil (fecha de validez)
        const validUntilStr = quotation.validUntil
          ? new Date(quotation.validUntil).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Montevideo' })
          : '-';

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(validUntilStr, contentX + 315, immInfoY, { width: 60 });

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('HORA:', contentX + 390, immInfoY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(timeStr, contentX + 435, immInfoY);

        // Línea decorativa
        doc
          .moveTo(contentX, immInfoY + 22)
          .lineTo(contentX + contentWidth, immInfoY + 22)
          .strokeColor('#e0e0e0')
          .lineWidth(1)
          .stroke();

        // === TABLA DE ITEMS ===
        const tableY = immInfoY + 32;
        const rowHeight = 20;

        // Columnas: CANT. | CÓDIGO | DETALLE / ARTÍCULO | MARCA | ORIGEN | V. UNIT (SIN IVA) | P.UNIT TOTAL | TOTAL
        const columns: Array<{ label: string, width: number, align: 'left' | 'center' | 'right' | 'justify' }> = [
          { label: 'CANT.', width: 35, align: 'center' },
          { label: 'CÓDIGO', width: 60, align: 'left' },
          { label: 'DETALLE / ARTÍCULO', width: 135, align: 'left' },
          { label: 'MARCA', width: 45, align: 'center' },
          { label: 'ORIGEN', width: 45, align: 'center' },
          { label: 'V. UNIT (SIN IVA)', width: 65, align: 'right' },
          { label: 'P.UNIT TOTAL', width: 65, align: 'right' },
          { label: 'TOTAL', width: 70, align: 'right' },
        ];

        let colX = contentX;
        const colPositions = columns.map(col => {
          const pos = colX;
          colX += col.width;
          return { ...col, x: pos };
        });

        // Header de tabla
        const headerHeight = 26;
        doc
          .fillColor('#4472C4')
          .rect(contentX, tableY, contentWidth, headerHeight)
          .fill();

        colPositions.forEach(col => {
          doc
            .fillColor('white')
            .fontSize(7)
            .font('Helvetica-Bold')
            .text(col.label, col.x + 2, tableY + 8, {
              width: col.width - 4,
              align: col.align
            });
        });

        // Items
        let currentY = tableY + headerHeight;
        doc.font('Helvetica').fontSize(8).fillColor('#333333');

        quotation.items.forEach((item, index) => {
          // Calcular altura dinámica de la fila basada en el detalle del producto
          const detailWidth = colPositions[2].width - 4;
          const textHeight = doc.heightOfString(item.productName, {
            width: detailWidth,
            align: 'left'
          });
          const dynamicRowHeight = Math.max(20, textHeight + 12); // 6px padding arriba/abajo

          // Fondo alternado
          if (index % 2 === 0) {
            doc.fillColor('#f5f5f5').rect(contentX, currentY, contentWidth, dynamicRowHeight).fill();
            doc.fillColor('#333333');
          }

          // Cantidad
          doc.text(item.quantity.toString(), colPositions[0].x + 3, currentY + 6, {
            width: colPositions[0].width - 6,
            align: 'center'
          });

          // Código
          const productCode = (item as any).product?.code || '-';
          doc.fontSize(7).text(productCode, colPositions[1].x + 2, currentY + 6, {
            width: colPositions[1].width - 4,
            align: 'left'
          });
          doc.fontSize(8);

          // Detalle (con lineBreak: true para nombres largos)
          const detailY = currentY + 6;
          doc.text(item.productName, colPositions[2].x + 2, detailY, {
            width: colPositions[2].width - 4,
            align: 'left',
            lineBreak: true
          });

          // Marca
          doc.fontSize(7).text(item.brand || '-', colPositions[3].x + 2, currentY + 6, {
            width: colPositions[3].width - 4,
            align: 'center'
          });
          doc.fontSize(8);

          // Origen
          doc.fontSize(7).text(item.origin || '-', colPositions[4].x + 2, currentY + 6, {
            width: colPositions[4].width - 4,
            align: 'center'
          });
          doc.fontSize(8);

          // V. UNIT (SIN IVA)
          const priceUnit = item.awardStatus === QuotationAwardStatus.NOT_AWARDED
            ? (item.competitorInfo?.winnerPrice || 0)
            : Number(item.priceWithoutIVA);
          doc.text(
            `${priceUnit.toFixed(2)}`,
            colPositions[5].x + 2,
            currentY + 6,
            { width: colPositions[5].width - 4, align: 'right' }
          );

          // P.UNIT TOTAL
          const priceUnitTotal = item.awardStatus === QuotationAwardStatus.NOT_AWARDED
            ? (item.competitorInfo?.winnerPrice || 0)
            : Number(item.priceWithIVA);
          doc.text(
            `${priceUnitTotal.toFixed(2)}`,
            colPositions[6].x + 2,
            currentY + 6,
            { width: colPositions[6].width - 4, align: 'right' }
          );

          // TOTAL
          const total = item.awardStatus === QuotationAwardStatus.NOT_AWARDED
            ? (item.competitorInfo?.winnerPrice || 0) * item.quantity
            : Number(item.priceWithIVA) * item.quantity;
          doc.text(
            `${total.toFixed(2)}`,
            colPositions[7].x + 2,
            currentY + 6,
            { width: colPositions[7].width - 4, align: 'right' }
          );

          // Bordes
          doc
            .strokeColor('#e5e7eb')
            .lineWidth(0.5)
            .rect(contentX, currentY, contentWidth, dynamicRowHeight)
            .stroke();

          currentY += dynamicRowHeight;
        });

        // Rellenar filas hasta mínimo 5
        const minRows = 5;
        const currentRows = quotation.items.length;
        if (currentRows < minRows) {
          for (let i = currentRows; i < minRows; i++) {
            if (i % 2 === 0) {
              doc.fillColor('#f5f5f5').rect(contentX, currentY, contentWidth, rowHeight).fill();
              doc.fillColor('#333333');
            }

            doc.fillColor('#cccccc');
            doc.text('-', colPositions[0].x + 3, currentY + 6, {
              width: colPositions[0].width - 6,
              align: 'center'
            });
            doc.text('0,00', colPositions[4].x + 2, currentY + 6, {
              width: colPositions[4].width - 4,
              align: 'right'
            });
            doc.text('0,00', colPositions[5].x + 2, currentY + 6, {
              width: colPositions[5].width - 4,
              align: 'right'
            });
            doc.text('0,00', colPositions[6].x + 2, currentY + 6, {
              width: colPositions[6].width - 4,
              align: 'right'
            });

            doc.strokeColor('#e5e7eb').lineWidth(0.5).rect(contentX, currentY, contentWidth, rowHeight).stroke();
            currentY += rowHeight;
          }
        }

        // Línea debajo de tabla
        doc
          .strokeColor('#4472C4')
          .lineWidth(1)
          .moveTo(contentX, currentY)
          .lineTo(contentX + contentWidth, currentY)
          .stroke();

        // === TOTALES (recuadro pequeño a la derecha) ===
        const totalsY = currentY + 10;
        const totalsBoxWidth = 200;
        const totalsBoxX = contentX + contentWidth - totalsBoxWidth;

        // Información a la izquierda del recuadro de totales
        const infoLeftY = totalsY;
        const infoLeftX = contentX;
        const infoLeftWidth = totalsBoxX - contentX - 10;

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Moneda Cotizada:', infoLeftX, infoLeftY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(quotation.items[0]?.currency || 'UYU', infoLeftX + 110, infoLeftY);

        const pagoY = infoLeftY + 18;
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Forma de Pago:', infoLeftX, pagoY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(quotation.paymentForm || '30 días', infoLeftX + 110, pagoY);

        const validezY = pagoY + 18;
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Validez:', infoLeftX, validezY);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(quotation.validity || '15 días', infoLeftX + 110, validezY);

        const subtotal = quotation.items.reduce((acc, item) => {
          const price = item.awardStatus === QuotationAwardStatus.NOT_AWARDED
            ? (item.competitorInfo?.winnerPrice || 0)
            : Number(item.priceWithoutIVA);
          return acc + (price * item.quantity);
        }, 0);

        const total = quotation.items.reduce((acc, item) => {
          const price = item.awardStatus === QuotationAwardStatus.NOT_AWARDED
            ? (item.competitorInfo?.winnerPrice || 0)
            : Number(item.priceWithIVA);
          return acc + (price * item.quantity);
        }, 0);

        const totalIva = total - subtotal;

        // Recuadro de totales pequeño a la derecha
        const totalsBoxHeight = 85;

        // Subtotal
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Subtotal:', totalsBoxX + 5, totalsY + 10);

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(`${subtotal.toFixed(2)}`, totalsBoxX + 110, totalsY + 10, {
            width: 85,
            align: 'right'
          });

        // IVA
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('IVA (22%):', totalsBoxX + 5, totalsY + 32);

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(`${totalIva.toFixed(2)}`, totalsBoxX + 110, totalsY + 32, {
            width: 85,
            align: 'right'
          });

        // Total
        doc
          .fillColor('#4472C4')
          .rect(totalsBoxX, totalsY + 52, totalsBoxWidth, 28)
          .fill();

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('white')
          .text('TOTAL:', totalsBoxX + 10, totalsY + 60);

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('white')
          .text(`${total.toFixed(2)} ${quotation.items[0]?.currency || ''}`, totalsBoxX + 110, totalsY + 60, {
            width: 85,
            align: 'right'
          });

        // === OBSERVACIONES ===
        const obsY = totalsY + 95;
        const obsBoxWidth = contentWidth;
        const obsBoxHeight = 45;

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor('#666666')
          .text('OBSERVACIONES:', contentX, obsY + 5);

        doc
          .fillColor('white')
          .rect(contentX, obsY + 15, obsBoxWidth, obsBoxHeight)
          .stroke();

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#333333')
          .text(quotation.observations || '', contentX + 5, obsY + 20, {
            width: obsBoxWidth - 10
          });

        // === FIRMA ===
        const footerY = obsY + obsBoxHeight + 10;

        // Línea decorativa
        doc
          .strokeColor('#e0e0e0')
          .lineWidth(1)
          .moveTo(contentX, footerY)
          .lineTo(contentX + contentWidth, footerY)
          .stroke();

        // Firma
        const signatureBoxWidth = 200;
        const signatureBoxX = contentX + contentWidth - signatureBoxWidth;

        try {
          const signaturePath = join(process.cwd(), 'assets', 'firma.png');
          const signatureBuffer = readFileSync(signaturePath);
          const signatureWidth = 100;
          doc.image(signatureBuffer, signatureBoxX + (signatureBoxWidth - signatureWidth) / 2, footerY + 10, { width: signatureWidth });
          
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#666666')
            .text('Firma Autorizada', signatureBoxX, footerY + 110, { width: signatureBoxWidth, align: 'center' });
        } catch (error) {
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text('Firma: Nicolas Cornalino', signatureBoxX, footerY + 40, { width: signatureBoxWidth, align: 'center' });
        }

        // === FOOTER ===
        // Eliminar aclaración de validez como factura por pedido del usuario

        // Finalizar PDF
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
}
