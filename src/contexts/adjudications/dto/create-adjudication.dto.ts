import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested, IsArray, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjudicationStatus } from '../entities/adjudication.entity';

export class CreateAdjudicationItemDto {
  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @IsNumber()
  productId?: number;

  @ApiPropertyOptional({ description: 'Nombre del producto' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({ description: 'Cantidad adjudicada' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Precio unitario adjudicado (sin IVA)' })
  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}

export class NonAwardedItemDto {
  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @IsNumber()
  productId?: number;

  @ApiProperty({ description: 'Nombre de la empresa ganadora' })
  @IsString()
  competitorName!: string;

  @ApiProperty({ description: 'RUT de la empresa ganadora' })
  @IsString()
  competitorRut!: string;

  @ApiProperty({ description: 'Precio de la competencia' })
  @IsNumber()
  @IsPositive()
  competitorPrice!: number;

  @ApiPropertyOptional({ description: 'Marca ofrecida por la competencia' })
  @IsOptional()
  @IsString()
  competitorBrand?: string;
}

export class CreateAdjudicationDto {
  @ApiProperty({ description: 'ID de la cotización asociada' })
  @IsNumber()
  quotationId!: number;

  @ApiProperty({ description: 'ID de la licitación asociada' })
  @IsNumber()
  licitationId!: number;

  @ApiProperty({ 
    description: 'Estado de la adjudicación',
    enum: ['total', 'parcial'],
    example: 'total'
  })
  @IsEnum(AdjudicationStatus)
  status!: AdjudicationStatus;

  @ApiProperty({ 
    description: 'Items adjudicados',
    type: [CreateAdjudicationItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdjudicationItemDto)
  items!: CreateAdjudicationItemDto[];

  @ApiPropertyOptional({ 
    description: 'Items NO adjudicados (para historial de competencia)',
    type: [NonAwardedItemDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NonAwardedItemDto)
  nonAwardedItems?: NonAwardedItemDto[];
}
