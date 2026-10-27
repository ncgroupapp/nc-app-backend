import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { Currency } from "../../shared/enums/currency.enum";

export class CreateStockPurchaseDto {
  @ApiPropertyOptional({ description: "ID del proveedor (si está dado de alta)", example: 27 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerId?: number | null;

  @ApiPropertyOptional({ description: "Nombre del proveedor (obligatorio si no se indica providerId)", example: "AYALA SA" })
  @ValidateIf((dto: CreateStockPurchaseDto) => !dto.providerId)
  @IsString()
  @MaxLength(255)
  providerName?: string | null;

  @ApiPropertyOptional({ description: "Fecha de compra (YYYY-MM-DD)", example: "2026-10-20" })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string | null;

  @ApiPropertyOptional({ description: "Número de pedido u orden de compra", example: "333" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  orderNumber?: string | null;

  @ApiProperty({ description: "Cantidad comprada", example: 10 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: "Costo unitario (sin IVA)", example: 74.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost!: number;

  @ApiProperty({ enum: Currency, default: Currency.USD })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiPropertyOptional({ description: "Notas" })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
