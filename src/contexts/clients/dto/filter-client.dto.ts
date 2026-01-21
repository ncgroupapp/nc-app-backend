import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export class FilterClientDto extends PaginationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  identifier?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
