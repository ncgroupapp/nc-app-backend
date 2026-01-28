import { PaginationDto } from '@/shared/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class FilterBrandsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  modelName?: string;
}
