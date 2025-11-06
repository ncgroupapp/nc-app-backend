import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { LicitationStatus } from "../entities/licitation.entity";

export class CreateLicitationDto {
  @ApiProperty({
    description: "Start date of the licitation",
    example: "2024-01-15",
    type: String,
    format: "date",
  })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({
    description: "Deadline date of the licitation",
    example: "2024-02-15",
    type: String,
    format: "date",
  })
  @IsDateString()
  @IsNotEmpty()
  deadlineDate!: string;

  @ApiProperty({
    description: "Client ID",
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  clientId!: number;

  @ApiProperty({
    description: "Call number",
    example: "LL-2024-001",
  })
  @IsString()
  @IsNotEmpty()
  callNumber!: string;

  @ApiProperty({
    description: "Internal number",
    example: "INT-2024-001",
  })
  @IsString()
  @IsNotEmpty()
  internalNumber!: string;

  @ApiProperty({
    description: "Product IDs",
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1, { message: "At least one product is required" })
  @Type(() => Number)
  productIds!: number[];

  @ApiProperty({
    description: "Status of the licitation",
    enum: LicitationStatus,
    example: LicitationStatus.EN_ESPERA,
    required: false,
  })
  @IsEnum(LicitationStatus)
  @IsOptional()
  status?: LicitationStatus;
}
