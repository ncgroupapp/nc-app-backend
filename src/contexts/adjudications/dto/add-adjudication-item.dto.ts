import { IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddAdjudicationItemDto {
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
