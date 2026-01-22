import { Controller, Get, Post, Patch, Param, Delete, Body, BadRequestException, NotFoundException, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ManualsService } from './manuals.service';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags('manuals')
@Controller('manuals')
@UseInterceptors(TransformInterceptor)
export class ManualsController {
  constructor(private readonly manualsService: ManualsService) {}

  @Post()
  @ApiBody({ type: CreateManualDto })
  async create(@Body() createManualDto: CreateManualDto) {
    return this.manualsService.create(createManualDto);
  }


  @Get()
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('search') search?: string
  ) {
    return this.manualsService.findAll(paginationDto, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.manualsService.findOne(+id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateManualDto })
  async update(@Param('id') id: string, @Body() updateManualDto: UpdateManualDto) {
    return this.manualsService.update(+id, updateManualDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manualsService.remove(+id);
  }
}

