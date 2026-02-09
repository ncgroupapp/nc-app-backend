import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Quotation } from './entities/quotation.entity';

@Injectable()
export class QuotationPdfService {
  /**
   * Genera un PDF de la cotización
   * @param quotation - Cotización a convertir en PDF
   * @returns Promise<Buffer> - Buffer del PDF generado
   */
  async generatePdf(quotation: Quotation): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Crear documento PDF
        const doc = new PDFDocument({ 
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Encabezado
        doc
          .fontSize(18)
          .font('Helvetica-Bold')
          .text('COTIZACIÓN', { align: 'center' })
          .moveDown(1);

        // Información del cliente y cotización
        const tableTop = doc.y;
        const leftTableX = 60;
        const leftTableWidth = 260;
        const rightTableX = 340;
        const rightTableWidth = 200;
        const rowHeight = 25;

        doc.fontSize(9).font('Helvetica-Bold');
        
        // TABLA IZQUIERDA
        // Fila 1: CLIENTE
        doc
          .fillColor('#4472C4')
          .rect(leftTableX, tableTop, 90, rowHeight)
          .fill()
          .fillColor('white')
          .text('CLIENTE', leftTableX + 5, tableTop + 8, { width: 80 });

        doc
          .fillColor('black')
          .rect(leftTableX + 90, tableTop, leftTableWidth - 90, rowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.clientName || 'N/A', leftTableX + 95, tableTop + 8, { width: leftTableWidth - 100 });

        // Fila 2: COMPRA
        const row2Y = tableTop + rowHeight;
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(leftTableX, row2Y, 90, rowHeight)
          .fill()
          .fillColor('white')
          .text('COMPRA', leftTableX + 5, row2Y + 8, { width: 80 });

        doc
          .fillColor('black')
          .rect(leftTableX + 90, row2Y, leftTableWidth - 90, rowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.associatedPurchase || quotation.quotationIdentifier, leftTableX + 95, row2Y + 8, { width: leftTableWidth - 100 });

        // TABLA DERECHA
        // Fila 1: IMM
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(rightTableX, tableTop, 60, rowHeight)
          .fill()
          .fillColor('white')
          .text('IMM', rightTableX + 5, tableTop + 8, { width: 50 });

        doc
          .fillColor('black')
          .rect(rightTableX + 60, tableTop, rightTableWidth - 60, rowHeight)
          .stroke();

        // Fila 2: APERT
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(rightTableX, row2Y, 60, rowHeight)
          .fill()
          .fillColor('white')
          .text('APERT', rightTableX + 5, row2Y + 8, { width: 50 });

        doc
          .fillColor('black')
          .rect(rightTableX + 60, row2Y, rightTableWidth - 60, rowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleDateString('es-CL') : '', rightTableX + 65, row2Y + 8, { width: rightTableWidth - 70 });

        // Fila 3: HORA
        const row3Y = row2Y + rowHeight;
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(rightTableX, row3Y, 60, rowHeight)
          .fill()
          .fillColor('white')
          .text('HORA', rightTableX + 5, row3Y + 8, { width: 50 });

        doc
          .fillColor('black')
          .rect(rightTableX + 60, row3Y, rightTableWidth - 60, rowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.quotationDate ? new Date(quotation.quotationDate).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + ' p.m.' : '', rightTableX + 65, row3Y + 8, { width: rightTableWidth - 70 });

        doc.moveDown(3);

        // Tabla de items
        const itemsTableTop = doc.y;
        const startX = 60;
        
        // Definir columnas con anchos ajustados
        const columns = [
          { label: 'CANT.', width: 30, align: 'center' as const },
          { label: 'DETALLE / ARTÍCULO', width: 170, align: 'left' as const },
          { label: 'MARCA', width: 60, align: 'center' as const },
          { label: 'ORIGEN', width: 50, align: 'center' as const },
          { label: 'V. UNIT (SIN IVA)', width: 60, align: 'right' as const },
          { label: 'TOTAL IVA', width: 60, align: 'right' as const },
          { label: 'TOTAL', width: 65, align: 'right' as const },
        ];

        // Calcular posiciones X para cada columna
        let currentX = startX;
        const columnPositions = columns.map(col => {
          const pos = currentX;
          currentX += col.width;
          return { ...col, x: pos };
        });

        // Encabezados de la tabla con fondo azul
        doc.fontSize(7).font('Helvetica-Bold');
        const headerHeight = 35;
        
        columnPositions.forEach(col => {
          doc
            .fillColor('#4472C4')
            .rect(col.x, itemsTableTop, col.width, headerHeight)
            .fill()
            .fillColor('white')
            .text(col.label, col.x + 2, itemsTableTop + 10, {
              width: col.width - 4,
              align: col.align
            });
        });

        // Items
        let currentY = itemsTableTop + headerHeight;
        const itemRowHeight = 25;
        doc.font('Helvetica').fontSize(8);

        quotation.items.forEach((item, index) => {
          // Fondo blanco alternado
          if (index % 2 === 0) {
            doc.fillColor('#f5f5f5').rect(startX, currentY, currentX - startX, itemRowHeight).fill();
          }

          doc.fillColor('black');
          
          // Cantidad
          doc.text(item.quantity.toString(), columnPositions[0].x + 2, currentY + 8, { 
            width: columnPositions[0].width - 4, 
            align: 'center' 
          });
          
          // Detalle (nombre del producto)
          doc.text(item.productName, columnPositions[1].x + 3, currentY + 8, { 
            width: columnPositions[1].width - 6, 
            align: 'left' 
          });
          
          // Marca
          doc.text(item.brand || '', columnPositions[2].x + 2, currentY + 8, { 
            width: columnPositions[2].width - 4, 
            align: 'center' 
          });

          // Origen
          doc.text(item.origin || '', columnPositions[3].x + 2, currentY + 8, { 
            width: columnPositions[3].width - 4, 
            align: 'center' 
          });
          
          // Valor unitario sin IVA
          doc.text(
            `${Number(item.priceWithoutIVA).toFixed(2)}`,
            columnPositions[4].x + 2,
            currentY + 8,
            { width: columnPositions[4].width - 4, align: 'right' }
          );
          
          // Total IVA (monto)
          const ivaPerUnit = Number(item.priceWithIVA) - Number(item.priceWithoutIVA);
          const totalIva = ivaPerUnit * item.quantity;
          doc.text(
            `${totalIva.toFixed(2)}`,
            columnPositions[5].x + 2,
            currentY + 8,
            { width: columnPositions[5].width - 4, align: 'right' }
          );
          
          // Total linea (con IVA)
          const total = Number(item.priceWithIVA) * item.quantity;
          doc.text(
            `${total.toFixed(2)}`,
            columnPositions[6].x + 2,
            currentY + 8,
            { width: columnPositions[6].width - 4, align: 'right' }
          );

          // Dibujar bordes de todas las celdas
          columnPositions.forEach(col => {
            doc.rect(col.x, currentY, col.width, itemRowHeight).stroke();
          });

          currentY += itemRowHeight;
        });

        // Agregar filas vacías si hay menos de 5 items
        const minRows = 5;
        const currentRows = quotation.items.length;
        if (currentRows < minRows) {
            for (let i = currentRows; i < minRows; i++) {
              if (i % 2 === 0) {
                doc.fillColor('#f5f5f5').rect(startX, currentY, currentX - startX, itemRowHeight).fill();
              }
              
              doc.fillColor('#999999'); // Texto gris suave para filas vacías
              
              // Cantidad
              doc.text('-', columnPositions[0].x + 2, currentY + 8, { 
                width: columnPositions[0].width - 4, 
                align: 'center' 
              });
              
              // Detalle
              doc.text('', columnPositions[1].x + 3, currentY + 8, { 
                width: columnPositions[1].width - 6, 
                align: 'left' 
              });
              
              // Ceros en columnas de precio
              doc.text('0,00', columnPositions[4].x + 2, currentY + 8, { 
                width: columnPositions[4].width - 4, 
                align: 'right' 
              });
              doc.text('0,00', columnPositions[5].x + 2, currentY + 8, { 
                width: columnPositions[5].width - 4, 
                align: 'right' 
              });
              doc.text('0,00', columnPositions[6].x + 2, currentY + 8, { 
                width: columnPositions[6].width - 4, 
                align: 'right' 
              });

              columnPositions.forEach(col => {
                doc.rect(col.x, currentY, col.width, itemRowHeight).stroke();
              });

              currentY += itemRowHeight;
            }
        }

        // Resumen de Totales
        const summaryWidth = columnPositions[5].width + columnPositions[6].width;
        const summaryX = columnPositions[5].x;
        const summaryRowHeight = 20;

        const subtotal = quotation.items.reduce((acc, item) => acc + (Number(item.priceWithoutIVA) * item.quantity), 0);
        const total = quotation.items.reduce((acc, item) => acc + (Number(item.priceWithIVA) * item.quantity), 0);
        const totalIva = total - subtotal;

        currentY += 10;
        doc.font('Helvetica-Bold').fontSize(8);

        // Subtotal
        doc.text('SUBTOTAL:', columnPositions[4].x, currentY + 5, { width: columnPositions[4].width, align: 'right' });
        doc.text(`${subtotal.toFixed(2)}`, columnPositions[6].x, currentY + 5, { width: columnPositions[6].width, align: 'right' });
        currentY += summaryRowHeight;

        // IVA
        doc.text('TOTAL IVA:', columnPositions[4].x, currentY + 5, { width: columnPositions[4].width, align: 'right' });
        doc.text(`${totalIva.toFixed(2)}`, columnPositions[6].x, currentY + 5, { width: columnPositions[6].width, align: 'right' });
        currentY += summaryRowHeight;

        // Total
        doc.fillColor('#4472C4').rect(columnPositions[4].x, currentY, columnPositions[6].x + columnPositions[6].width - columnPositions[4].x, summaryRowHeight).fill();
        doc.fillColor('white');
        doc.text('TOTAL:', columnPositions[4].x, currentY + 5, { width: columnPositions[4].width, align: 'right' });
        doc.text(`${total.toFixed(2)} ${quotation.items[0]?.currency || ''}`, columnPositions[6].x, currentY + 5, { width: columnPositions[6].width, align: 'right' });
        
        doc.fillColor('black');
        currentY += summaryRowHeight + 20;

        doc.moveDown(1.5);
        currentY = doc.y;

        // Información adicional (Moneda, Forma de Pago, Validez, Observaciones)
        const infoBoxY = currentY;
        const leftInfoX = 60;
        const leftInfoWidth = 200;
        const obsX = 280;
        const obsWidth = 275;
        const infoRowHeight = 25;

        doc.fontSize(9).font('Helvetica-Bold');

        // Moneda Cotizada
        doc
          .fillColor('#4472C4')
          .rect(leftInfoX, infoBoxY, 120, infoRowHeight)
          .fill()
          .fillColor('white')
          .text('Moneda Cotizada', leftInfoX + 5, infoBoxY + 8, { width: 110 });

        doc
          .fillColor('black')
          .rect(leftInfoX + 120, infoBoxY, leftInfoWidth - 120, infoRowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.items[0]?.currency || 'USD', leftInfoX + 125, infoBoxY + 8, { 
            width: leftInfoWidth - 130 
          });

        // Forma de Pago
        const formaPagoY = infoBoxY + infoRowHeight;
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(leftInfoX, formaPagoY, 120, infoRowHeight)
          .fill()
          .fillColor('white')
          .text('Forma de Pago', leftInfoX + 5, formaPagoY + 8, { width: 110 });

        doc
          .fillColor('black')
          .rect(leftInfoX + 120, formaPagoY, leftInfoWidth - 120, infoRowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.paymentForm || '30 días', leftInfoX + 125, formaPagoY + 8, { 
            width: leftInfoWidth - 130 
          });

        // Validez
        const validezY = formaPagoY + infoRowHeight;
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(leftInfoX, validezY, 120, infoRowHeight)
          .fill()
          .fillColor('white')
          .text('VALIDEZ', leftInfoX + 5, validezY + 8, { width: 110 });

        doc
          .fillColor('black')
          .rect(leftInfoX + 120, validezY, leftInfoWidth - 120, infoRowHeight)
          .stroke()
          .font('Helvetica')
          .text(quotation.validity || '30 días', leftInfoX + 125, validezY + 8, { 
            width: leftInfoWidth - 130 
          });

        // Observaciones (cuadro grande a la derecha)
        const obsHeight = infoRowHeight * 3;
        doc
          .font('Helvetica-Bold')
          .fillColor('#4472C4')
          .rect(obsX, infoBoxY, obsWidth, infoRowHeight)
          .fill()
          .fillColor('white')
          .text('OBSERVACIONES', obsX + 5, infoBoxY + 8, { 
            width: obsWidth - 10, 
            align: 'center' 
          });

        doc
          .fillColor('black')
          .rect(obsX, infoBoxY + infoRowHeight, obsWidth, obsHeight - infoRowHeight)
          .stroke()
          .font('Helvetica')
          .fontSize(8)
          .text(quotation.observations || '', obsX + 5, infoBoxY + infoRowHeight + 5, { 
            width: obsWidth - 10, 
            align: 'left'
          });

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
