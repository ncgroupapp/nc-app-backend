import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OffersService } from "./offers.service";
import { OffersController } from "./offers.controller";
import { Offer } from "./entities/offer.entity";
import { Product } from "@/contexts/products/entities/product.entity";
import { Provider } from "@/contexts/providers/entities/provider.entity";
import { ProductsModule } from "@/contexts/products/products.module";
import { ProvidersModule } from "@/contexts/providers/providers.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer, Product, Provider]),
    ProductsModule,
    ProvidersModule,
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}

