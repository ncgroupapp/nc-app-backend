import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualsService } from './manuals.service';
import { ManualsController } from './manuals.controller';
import { Manual } from './entities/manual.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Manual])],
  controllers: [ManualsController],
  providers: [ManualsService],
})
export class ManualsModule {}
