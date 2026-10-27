import { PartialType } from "@nestjs/swagger";
import { CreateStockPurchaseDto } from "./create-stock-purchase.dto";

export class UpdateStockPurchaseDto extends PartialType(CreateStockPurchaseDto) {}
