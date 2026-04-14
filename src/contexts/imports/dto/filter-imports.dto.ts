import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FilterImportsDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by status (partial match)', example: 'En Tránsito' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by folder (partial match)', example: 'CARP-2026-01' })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({ description: 'Filter by transport (partial match)', example: 'Maritimo' })
  @IsOptional()
  @IsString()
  transport?: string;

  @ApiPropertyOptional({ description: 'Filter by exact import date', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  importDate?: string;

  @ApiPropertyOptional({ description: 'Filter imports from this date', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter imports up to this date', example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by one provider ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  providerId?: number;

  @ApiPropertyOptional({ description: 'Filter by provider IDs', example: [1, 2], type: [Number] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }: { value: string | number[] }) => {
    if (typeof value === 'string') {
      return value.split(',').map((id: string) => parseInt(id.trim(), 10));
    }
    return value;
  })
  @IsInt({ each: true })
  providerIds?: number[];

  @ApiPropertyOptional({ description: 'Search term for filtering imports', example: 'example search' })
  @IsOptional()
  @IsString()
  search?: string;
}