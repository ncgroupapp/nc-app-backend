import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Remito, RemitoItem } from "./entities/remito.entity";
import { ShippingGuide } from "./entities/shipping-guide.entity";
import { RemitosController } from "./remitos.controller";
import { RemitosService } from "./remitos.service";
import { RemitosPdfService } from "./remitos-pdf.service";

@Module({
  imports: [TypeOrmModule.forFeature([Remito, RemitoItem, ShippingGuide])],
  controllers: [RemitosController],
  providers: [RemitosService, RemitosPdfService],
})
export class RemitosModule {}
