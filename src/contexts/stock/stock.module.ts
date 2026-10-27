import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "../products/entities/product.entity";
import { Provider } from "../providers/entities/provider.entity";
import { StockPurchase } from "./entities/stock-purchase.entity";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  imports: [TypeOrmModule.forFeature([StockPurchase, Product, Provider])],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
