import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class FilterStockDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Buscar por nombre, código, código equivalente, marca o modelo" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "pocas: 1 o 2 unidades; sin_costo: sin ninguna compra registrada" })
  @IsOptional()
  @IsIn(["pocas", "sin_costo"])
  view?: "pocas" | "sin_costo";

  @ApiPropertyOptional({ description: "Marca exacta (sin distinguir mayúsculas)" })
  @IsOptional()
  @IsString()
  brand?: string;
}
