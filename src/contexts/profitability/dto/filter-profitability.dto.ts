import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export const PROFITABILITY_STATUSES = ["abierta", "presentada", "adjudicada", "perdida", "cerrada"] as const;
export type ProfitabilityStatus = (typeof PROFITABILITY_STATUSES)[number];

export class FilterProfitabilityDto {
  @ApiPropertyOptional({ description: "Licitaciones con fecha de inicio desde (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Licitaciones con fecha de inicio hasta (YYYY-MM-DD, inclusive)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: PROFITABILITY_STATUSES })
  @IsOptional()
  @IsIn(PROFITABILITY_STATUSES)
  status?: ProfitabilityStatus;

  @ApiPropertyOptional({ description: "Cliente u organismo" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clientId?: number;

  @ApiPropertyOptional({ description: "Producto (nombre o código)" })
  @IsOptional()
  @IsString()
  product?: string;

  @ApiPropertyOptional({ description: "Número de compra o número interno" })
  @IsOptional()
  @IsString()
  search?: string;
}
