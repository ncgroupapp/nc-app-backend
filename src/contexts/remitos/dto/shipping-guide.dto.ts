import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export class CreateShippingGuideDto {
  @ApiProperty({ description: "Nombre del destinatario" })
  @IsString()
  @MaxLength(255)
  recipientName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientPhone?: string | null;

  @ApiPropertyOptional({ description: "Hasta 3 líneas de dirección", type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  addressLines?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  senderPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  senderRut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clientId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  remitoId?: number | null;
}

export class UpdateShippingGuideDto extends PartialType(CreateShippingGuideDto) {}
