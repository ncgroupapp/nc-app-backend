import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjudicationsService } from './adjudications.service';
import { AdjudicationsController } from './adjudications.controller';
import { Adjudication, AdjudicationItem } from './entities/adjudication.entity';
import { DeliveriesModule } from '@/contexts/deliveries/deliveries.module';
import { Quotation } from '@/contexts/quotation/entities/quotation.entity';
import { Licitation } from '@/contexts/licitations/entities/licitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Adjudication, AdjudicationItem, Quotation, Licitation]),
    DeliveriesModule,
  ],
  controllers: [AdjudicationsController],
  providers: [AdjudicationsService],
  exports: [AdjudicationsService],
})
export class AdjudicationsModule {}
