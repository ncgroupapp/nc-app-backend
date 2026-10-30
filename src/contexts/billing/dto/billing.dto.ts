import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../../shared/dto/pagination.dto";
import { BillingDocumentType } from "../entities/billing-document.entity";

export class FilterBillingDocumentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BillingDocumentType)
  type?: BillingDocumentType;

  @IsOptional()
  @IsIn(["UYU", "USD"])
  currency?: string;
}

/** Manual corrections for data that could not be read from the file */
export class UpdateBillingDocumentDto {
  @IsOptional()
  @IsEnum(BillingDocumentType)
  type?: BillingDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  series?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  number?: string | null;

  @IsOptional()
  @IsDateString()
  issueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  clientRut?: string | null;

  @IsOptional()
  @IsIn(["UYU", "USD"])
  currency?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  subtotal?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tax?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  total?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNumber?: string | null;
}
