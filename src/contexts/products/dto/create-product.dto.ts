import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsArray, IsUrl, IsInt } from 'class-validator';

export class CreateProductDto {


  @ApiProperty({ description: 'Product name', example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Product images URLs', example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @IsUrl({}, { each: true })
  images?: string[];

  @ApiProperty({ description: 'Provider IDs', example: [1, 2, 3], required: false })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsInt({ each: true })
  @IsOptional()
  providerIds?: number[];

  @ApiProperty({ description: 'Product brand', example: 'Dell', required: false })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ description: 'Product model', example: 'XPS 13', required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ description: 'Product code', example: 'PROD-001', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: 'Equivalent codes', example: ['CODE1', 'CODE2'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  equivalentCodes?: string[];

  @ApiProperty({ description: 'Stock quantity', example: 10, required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stockQuantity?: number;

  @ApiProperty({ description: 'Product details', example: 'High-performance laptop with SSD', required: false })
  @IsString()
  @IsOptional()
  details?: string;

  @ApiProperty({ description: 'Product observations', example: 'Handle with care', required: false })
  @IsString()
  @IsOptional()
  observations?: string;

  @ApiProperty({ description: 'Chassis information', example: 'Aluminum unibody', required: false })
  @IsString()
  @IsOptional()
  chassis?: string;

  @ApiProperty({ description: 'Motor information', example: 'V6 2.5L', required: false })
  @IsString()
  @IsOptional()
  motor?: string;

  @ApiProperty({ description: 'Equipment information', example: 'Standard equipment package', required: false })
  @IsString()
  @IsOptional()
  equipment?: string;

  @ApiProperty({ description: 'Previous quotes history', example: [], required: false })
  @IsArray()
  @IsOptional()
  quotationHistory?: any[];

  @ApiProperty({ description: 'Previous adjudications history', example: [], required: false })
  @IsArray()
  @IsOptional()
  adjudicationHistory?: any[];

  // Legacy fields for backward compatibility
  @ApiProperty({ description: 'Product description', example: 'High-performance laptop', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Product price', example: 999.99, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @ApiProperty({ description: 'Product stock', example: 10, default: 0, required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;
}
