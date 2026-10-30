import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { RemitoStatus } from "../entities/remito.entity";

export class RemitoItemDto {
  @ApiPropertyOptional({ description: "Producto del sistema (opcional)" })
  @IsOptional()
  @IsInt()
  productId?: number | null;

  @ApiPropertyOptional({ description: "Código del producto" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string | null;

  @ApiProperty({ description: "Descripción" })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ description: "Cantidad entregada" })
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

export class CreateRemitoDto {
  @ApiPropertyOptional({ description: "Fecha (YYYY-MM-DD); hoy si se omite" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clientId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  licitationId?: number | null;

  @ApiProperty({ description: "Nombre del cliente" })
  @IsString()
  @MaxLength(255)
  receiverName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiverRut?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiverAddress?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiverCity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receiverPhone?: string | null;

  @ApiPropertyOptional({ description: "Orden de compra del cliente" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  purchaseOrder?: string | null;

  @ApiPropertyOptional({ description: "Referencia (ej. licitación)" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string | null;

  @ApiPropertyOptional({ description: "Observaciones" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({ type: [RemitoItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RemitoItemDto)
  items!: RemitoItemDto[];
}

export class UpdateRemitoDto extends PartialType(CreateRemitoDto) {
  @ApiPropertyOptional({ enum: RemitoStatus })
  @IsOptional()
  @IsIn(Object.values(RemitoStatus))
  status?: RemitoStatus;

  @ApiPropertyOptional({ description: "Fecha de entrega (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  deliveredAt?: string | null;
}

export class FilterRemitosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RemitoStatus })
  @IsOptional()
  @IsIn(Object.values(RemitoStatus))
  status?: RemitoStatus;
}
