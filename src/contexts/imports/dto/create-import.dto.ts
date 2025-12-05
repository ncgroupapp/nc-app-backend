import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsEnum, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateImportDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  folder?: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  providerId!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transport!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  arbitrage?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  exchangeRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  packageCount!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalWeight!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originCurrency!: string;

  @Type(() => Date)
  @ApiProperty()
  @IsNotEmpty()
  importDate!: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  productIds?: number[];

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  licitationIds?: number[];

  // Cost Structure A: Base Costs
  @ApiProperty()
  @IsNumber()
  @Min(0)
  fobOrigin!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  fobUsd!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  freightOrigin!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  freightUsd!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  insuranceOrigin!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  insuranceUsd!: number;

  // Cost Structure B: Tributos Oficiales Exentos de IVA (Rates)
  @ApiProperty()
  @IsNumber()
  @Min(0)
  advanceVatRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  transitGuideRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  imaduniRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  vatRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  surchargeRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  consularFeesRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  tcuRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  auriStampsRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  tsaRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  bankCharges!: number;

  // Cost Structure C: Otros Pagos Exentos de IVA
  @ApiPropertyOptional()
  @IsOptional()
  otherExemptPayments?: Record<string, number>;

  // Cost Structure D: Pagos Gravados de IVA (Rates)
  @ApiProperty()
  @IsNumber()
  @Min(0)
  dispatchExpensesRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  customsSurchargeRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  feesRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  externalFreightRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  insuranceTaxRate!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  internalFreightRate!: number;
}
