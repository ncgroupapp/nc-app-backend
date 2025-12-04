import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { Import } from './entities/import.entity';
import { Product } from '../products/entities/product.entity';
import { Licitation } from '../licitations/entities/licitation.entity';
import { Provider } from '../providers/entities/provider.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Import, Product, Licitation, Provider])],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
