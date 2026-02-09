import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateModelDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateModelDto)
  models?: CreateModelDto[];
}
