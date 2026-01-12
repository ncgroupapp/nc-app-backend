import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, IsInt, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class FilterProductsDto {
  @ApiPropertyOptional({ description: 'Filter by product name (partial match)', example: 'Laptop' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by brand (partial match)', example: 'Dell' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Filter by model (partial match)', example: 'Latitude 5520' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ description: 'Filter by details (partial match)', example: 'Intel Core i7' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: 'Filter by description (partial match)', example: 'High-performance' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Filter by observations (partial match)', example: 'Warranty included' })
  @IsOptional()
  @IsString()
  observations?: string;

  @ApiPropertyOptional({ description: 'Filter by equipment (partial match)', example: 'RAM 16GB' })
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional({ description: 'Filter by chassis (partial match)', example: 'ABC123' })
  @IsOptional()
  @IsString()
  chassis?: string;

  @ApiPropertyOptional({ description: 'Filter by motor (partial match)', example: 'V8' })
  @IsOptional()
  @IsString()
  motor?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum price', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum price', example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filter by minimum stock', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

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

  @ApiPropertyOptional({ description: 'General search term across name, brand, model, description', example: 'laptop' })
  @IsOptional()
  @IsString()
  search?: string;
}
