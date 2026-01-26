import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  ArrayMinSize,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { LicitationStatus } from "../entities/licitation.entity";

export class ProductWithQuantityDto {
  @ApiProperty({
    description: "Product ID",
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  productId!: number;

  @ApiProperty({
    description: "Quantity requested",
    example: 10,
    default: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  quantity?: number;
}

export class CreateLicitationDto {
  @ApiProperty({
    description: "Start date of the licitation",
    example: "2024-01-15",
    type: String,
    format: "date",
  })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({
    description: "Deadline date of the licitation",
    example: "2024-02-15",
    type: String,
    format: "date",
  })
  @IsDateString()
  @IsNotEmpty()
  deadlineDate!: string;

  @ApiProperty({
    description: "Client ID",
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  clientId!: number;

  @ApiProperty({
    description: "Call number",
    example: "LL-2024-001",
  })
  @IsString()
  @IsNotEmpty()
  callNumber!: string;

  @ApiProperty({
    description: "Internal number",
    example: "INT-2024-001",
  })
  @IsString()
  @IsNotEmpty()
  internalNumber!: string;

  @ApiProperty({
    description: "Products with quantity",
    type: [ProductWithQuantityDto],
    example: [{ productId: 1, quantity: 10 }, { productId: 2, quantity: 5 }],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductWithQuantityDto)
  @IsOptional()
  products?: ProductWithQuantityDto[];

  @ApiProperty({
    description: "Product IDs (deprecated, use 'products' instead)",
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  @IsOptional()
  productIds?: number[];

  @ApiProperty({
    description: "Status of the licitation",
    enum: LicitationStatus,
    example: LicitationStatus.PENDING,
    required: false,
  })
  @IsEnum(LicitationStatus)
  @IsOptional()
  status?: LicitationStatus;
}
