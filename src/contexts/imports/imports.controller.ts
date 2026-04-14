import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { CreateImportDto } from './dto/create-import.dto';
import { UpdateImportDto } from './dto/update-import.dto';
import { FilterImportsDto } from './dto/filter-imports.dto';
import { Import } from './entities/import.entity';
import { PaginatedResult } from '../shared/interfaces/paginated-result.interface';
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
  @ApiOperation({ summary: 'Get all imports with optional filters' })
  @ApiResponse({ status: 200, description: 'List of imports', type: [Import] })
  findAll(@Query() filters: FilterImportsDto): Promise<PaginatedResult<Import>> {
    return this.importsService.findAll(filters);
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
