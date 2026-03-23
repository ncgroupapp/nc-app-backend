import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateOfferDto {
  @ApiProperty({
    description: "Offer name (Compra Directa)",
    example: "Compra Directa 2024-001",
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: "Product ID",
    example: 1,
  })
  @IsNumber()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  productId!: number;

  @ApiProperty({
    description: "Provider ID",
    example: 1,
  })
  @IsNumber()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  providerId!: number;

  @ApiProperty({
    description: "Offer price",
    example: 150000.50,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price!: number;

  @ApiProperty({
    description: "Offer IVA amount",
    example: 24000.08,
    required: false,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  iva?: number;

  @ApiProperty({
    description: "Delivery date",
    example: "2024-12-31",
  })
  @IsDateString()
  @IsNotEmpty()
  deliveryDate!: string;

  @ApiProperty({
    description: "Delivery time in days",
    example: 5,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  delivery!: number;

  @ApiProperty({
    description: "Origin",
    example: "China",
    required: false,
  })
  @IsString()
  @IsOptional()
  origin?: string;

  @ApiProperty({
    description: "Quantity",
    example: 10,
  })
  @IsNumber()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

