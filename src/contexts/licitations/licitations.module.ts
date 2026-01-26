import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LicitationsService } from "./licitations.service";
import { LicitationsController } from "./licitations.controller";
import { Licitation } from "./entities/licitation.entity";
import { LicitationProduct } from "./entities/licitation-product.entity";
import { Client } from "@/contexts/clients/entities/client.entity";
import { Product } from "@/contexts/products/entities/product.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Licitation, LicitationProduct, Client, Product])],
  controllers: [LicitationsController],
  providers: [LicitationsService],
  exports: [LicitationsService],
})
export class LicitationsModule {}
