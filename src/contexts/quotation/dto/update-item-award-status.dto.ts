import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuotationAwardStatus } from '../entities/quotation.entity';

export class UpdateItemAwardStatusDto {
  @ApiProperty({
    description: 'Estado de adjudicación',
    enum: QuotationAwardStatus,
  })
  @IsEnum(QuotationAwardStatus)
  awardStatus!: QuotationAwardStatus;

  @ApiPropertyOptional({
    description: 'Cantidad adjudicada (solo para adjudicaciones parciales)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  awardedQuantity?: number;
}
