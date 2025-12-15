import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuotationStatus,
  QuotationAwardStatus,
  Currency,
} from '../entities/quotation.entity';

export class CreateQuotationItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsNumber()
  productId!: number;

  @ApiPropertyOptional({ description: 'ID del proveedor (si existe en el sistema)' })
  @IsOptional()
  @IsNumber()
  providerId?: number;

  @ApiPropertyOptional({ description: 'Nombre del proveedor' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiProperty({ description: 'Indica si el producto está en stock', default: false })
  @IsBoolean()
  inStock!: boolean;

  @ApiProperty({ description: 'Cantidad solicitada' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Plazo de entrega en días hábiles' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryTime?: number;

  @ApiProperty({ description: 'Precio cotizado sin IVA' })
  @IsNumber()
  @IsPositive()
  priceWithoutIVA!: number;

  @ApiProperty({ description: 'Precio cotizado con IVA' })
  @IsNumber()
  @IsPositive()
  priceWithIVA!: number;

  @ApiProperty({ description: 'Porcentaje de IVA', default: 19 })
  @IsNumber()
  @Min(0)
  @Max(100)
  ivaPercentage!: number;

  @ApiProperty({ description: 'Moneda cotizada', enum: Currency, default: Currency.CLP })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({
    description: 'Estado de adjudicación',
    enum: QuotationAwardStatus,
    default: QuotationAwardStatus.PENDING,
  })
  @IsEnum(QuotationAwardStatus)
  awardStatus!: QuotationAwardStatus;

  @ApiPropertyOptional({ description: 'Notas adicionales sobre el item' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateQuotationDto {
  @ApiProperty({ description: 'Identificador único de la cotización', example: 'COT-2024-001' })
  @IsString()
  quotationIdentifier!: string;

  @ApiPropertyOptional({ description: 'Compra asociada', example: 'Licitación 5544-LP-24' })
  @IsOptional()
  @IsString()
  associatedPurchase?: string;

  @ApiProperty({
    description: 'Estado de la cotización',
    enum: QuotationStatus,
    default: QuotationStatus.CREATED,
  })
  @IsEnum(QuotationStatus)
  status!: QuotationStatus;

  @ApiPropertyOptional({ description: 'Descripción de la cotización', example: 'Cotización de equipos informáticos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Observaciones generales', example: 'Entrega en bodega central' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiProperty({ description: 'Items de la cotización', type: [CreateQuotationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];

  @ApiPropertyOptional({ description: 'Fecha de la cotización', example: '2024-11-25T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  quotationDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de validez de la cotización', example: '2024-12-10T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ description: 'ID del cliente', example: 1 })
  @IsOptional()
  @IsNumber()
  clientId?: number;

  @ApiProperty({ description: 'ID de la licitación asociada', example: 1 })
  @IsNumber()
  licitationId!: number;

  @ApiPropertyOptional({ description: 'Nombre del cliente', example: 'Empresa Cliente SpA' })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'Forma de pago (ej: "30 días")', example: '30 días' })
  @IsOptional()
  @IsString()
  paymentForm?: string;

  @ApiPropertyOptional({ description: 'Validez de la cotización (ej: "30 días")', example: '15 días' })
  @IsOptional()
  @IsString()
  validity?: string;
}
