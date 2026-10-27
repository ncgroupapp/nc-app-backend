import { IsInt, Min, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetItemOfferDto {
  @ApiProperty({
    description: 'Oferta del proveedor que define el costo del ítem (null para quitarla)',
    nullable: true,
    type: Number,
  })
  @ValidateIf((dto: SetItemOfferDto) => dto.offerId !== null)
  @IsInt()
  @Min(1)
  offerId!: number | null;
}
