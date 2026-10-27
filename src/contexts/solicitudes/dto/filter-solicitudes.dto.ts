import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SolicitudStatus } from "../entities/solicitud.entity";

export class FilterSolicitudesDto {
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

  @ApiPropertyOptional({ description: "Buscar en asunto, remitente y contenido" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SolicitudStatus })
  @IsOptional()
  @IsEnum(SolicitudStatus)
  status?: SolicitudStatus;

  @ApiPropertyOptional({ description: "Mail o nombre del remitente" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: "Recibidas desde (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Recibidas hasta (YYYY-MM-DD, inclusive)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
