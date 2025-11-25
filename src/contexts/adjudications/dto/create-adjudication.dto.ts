import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested, IsArray, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjudicationStatus } from '../entities/adjudication.entity';

export class CreateAdjudicationItemDto {
  @ApiPropertyOptional({ description: 'ID del producto (si existe en el sistema)' })
  @IsOptional()
  @IsNumber()
  productId?: number;

  @ApiProperty({ description: 'SKU o Parte Número del producto' })
  @IsString()
  sku!: string;

  @ApiProperty({ description: 'Cantidad adjudicada' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Precio unitario adjudicado (sin IVA)' })
  @IsNumber()
  @IsPositive()
  unitPrice!: number;
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
}
