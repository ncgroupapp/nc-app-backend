import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Product description', example: 'High-performance laptop', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Product price', example: 999.99 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ description: 'Product stock', example: 10, default: 0 })
  @IsNumber()
  @Min(0)
  stock!: number;
}
