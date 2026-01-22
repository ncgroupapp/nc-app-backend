import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { CreateImportDto } from './dto/create-import.dto';
import { UpdateImportDto } from './dto/update-import.dto';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags('imports')
@Controller('imports')
@UseInterceptors(TransformInterceptor)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post()
  create(@Body() createImportDto: CreateImportDto) {
    return this.importsService.create(createImportDto);
  }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'providerId', required: false, type: Number })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('providerId') providerId?: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.importsService.findAll(paginationDto, status, providerId, fromDate, toDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.importsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateImportDto: UpdateImportDto) {
    return this.importsService.update(+id, updateImportDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.importsService.remove(+id);
  }
}
