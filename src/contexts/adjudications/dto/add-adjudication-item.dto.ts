import { IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddAdjudicationItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsNumber()
  productId!: number;

  @ApiProperty({ description: 'Cantidad adjudicada' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Precio unitario adjudicado (sin IVA)' })
  @IsNumber()
  @IsPositive()
  unitPrice!: number;
}
