import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { ImportsService } from './imports.service';
import { CreateImportDto } from './dto/create-import.dto';
import { UpdateImportDto } from './dto/update-import.dto';

@ApiTags('imports')
@Controller('imports')
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
    @Query('status') status?: string,
    @Query('providerId') providerId?: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.importsService.findAll(status, providerId, fromDate, toDate);
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
