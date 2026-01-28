import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { Quotation, QuotationItem } from './entities/quotation.entity';
import { QuotationPdfService } from './quotation-pdf.service';
import { AdjudicationsModule } from '../adjudications/adjudications.module';
import { Product } from '../products/entities/product.entity';
import { Licitation } from '../licitations/entities/licitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationItem, Product, Licitation]),
    AdjudicationsModule,
  ],
  controllers: [QuotationController],
  providers: [QuotationService, QuotationPdfService],
  exports: [QuotationService, QuotationPdfService],
})
export class QuotationModule {}
