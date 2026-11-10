import { PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class SavePurchaseOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  number!: string;

  @IsOptional()
  @IsDateString()
  issueDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  licitationId?: number | null;

  @IsOptional()
  @IsIn(["UYU", "USD"])
  currency?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /** Invoices (billing documents) this order was billed with */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  invoiceIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  remitoIds?: number[];
}

export class UpdatePurchaseOrderDto extends PartialType(SavePurchaseOrderDto) {}

export class FilterPurchaseOrdersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
