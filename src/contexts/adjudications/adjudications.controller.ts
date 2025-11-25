import { Controller, Get, Post, Body, Param, Query, Delete, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdjudicationsService } from './adjudications.service';
import { CreateAdjudicationDto } from './dto/create-adjudication.dto';
import { AddAdjudicationItemDto } from './dto/add-adjudication-item.dto';
import { Adjudication } from './entities/adjudication.entity';

@ApiTags('adjudications')
@Controller('adjudications')
export class AdjudicationsController {
  constructor(private readonly adjudicationsService: AdjudicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva adjudicación' })
  @ApiResponse({
    status: 201,
    description: 'Adjudicación creada exitosamente. También se crea automáticamente una entrega asociada.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización o Licitación no encontrada',
  })
  create(@Body() createAdjudicationDto: CreateAdjudicationDto): Promise<Adjudication> {
    return this.adjudicationsService.create(createAdjudicationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las adjudicaciones con filtros opcionales' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['total', 'parcial'],
    description: 'Filtrar por estado (total/parcial)',
  })
  @ApiQuery({
    name: 'quotationId',
    required: false,
    description: 'Filtrar por ID de cotización',
  })
  @ApiQuery({
    name: 'licitationId',
    required: false,
    description: 'Filtrar por ID de licitación',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de adjudicaciones obtenida exitosamente',
  })
  findAll(
    @Query('status') status?: string,
    @Query('quotationId') quotationId?: string,
    @Query('licitationId') licitationId?: string,
  ): Promise<Adjudication[]> {
    if (status) {
      return this.adjudicationsService.findByStatus(status as any);
    }
    if (quotationId) {
      return this.adjudicationsService.findByQuotation(+quotationId);
    }
    if (licitationId) {
      return this.adjudicationsService.findByLicitation(+licitationId);
    }
    return this.adjudicationsService.findAll();
  }

  @Get('quotation/:quotationId')
  @ApiOperation({ summary: 'Obtener adjudicaciones por ID de cotización' })
  @ApiParam({ name: 'quotationId', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Lista de adjudicaciones de la cotización',
  })
  findByQuotation(@Param('quotationId') quotationId: string): Promise<Adjudication[]> {
    return this.adjudicationsService.findByQuotation(+quotationId);
  }

  @Get('licitation/:licitationId')
  @ApiOperation({ summary: 'Obtener adjudicaciones por ID de licitación' })
  @ApiParam({ name: 'licitationId', description: 'ID de la licitación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de adjudicaciones de la licitación',
  })
  findByLicitation(@Param('licitationId') licitationId: string): Promise<Adjudication[]> {
    return this.adjudicationsService.findByLicitation(+licitationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener adjudicación por ID' })
  @ApiParam({ name: 'id', description: 'ID de la adjudicación' })
  @ApiResponse({
    status: 200,
    description: 'Adjudicación encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Adjudicación no encontrada',
  })
  findOne(@Param('id') id: string): Promise<Adjudication> {
    return this.adjudicationsService.findOne(+id);
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Agregar un producto a una adjudicación existente' })
  @ApiParam({ name: 'id', description: 'ID de la adjudicación' })
  @ApiResponse({
    status: 200,
    description: 'Producto agregado exitosamente. Los totales se recalculan automáticamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Adjudicación no encontrada',
  })
  addItem(
    @Param('id') id: string,
    @Body() addItemDto: AddAdjudicationItemDto,
  ): Promise<Adjudication> {
    return this.adjudicationsService.addItem(+id, addItemDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar adjudicación' })
  @ApiParam({ name: 'id', description: 'ID de la adjudicación' })
  @ApiResponse({
    status: 204,
    description: 'Adjudicación eliminada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Adjudicación no encontrada',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.adjudicationsService.remove(+id);
  }
}
