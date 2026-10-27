import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { SolicitudStatus } from "../entities/solicitud.entity";

export class UpdateSolicitudDto {
  @ApiPropertyOptional({ enum: SolicitudStatus })
  @IsOptional()
  @IsEnum(SolicitudStatus)
  status?: SolicitudStatus;

  @ApiPropertyOptional({ description: "Responsable asignado", example: "Admin" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  assignee?: string | null;

  @ApiPropertyOptional({ description: "Notas internas" })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
