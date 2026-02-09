import { Controller, Get, Post, Body, Param, Query, Delete, HttpCode, HttpStatus, Patch, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdjudicationsService } from './adjudications.service';
import { CreateAdjudicationDto } from './dto/create-adjudication.dto';
import { AddAdjudicationItemDto } from './dto/add-adjudication-item.dto';
import { Adjudication } from './entities/adjudication.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags('adjudications')
@Controller('adjudications')
@UseInterceptors(TransformInterceptor)
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
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: string,
    @Query('quotationId') quotationId?: string,
    @Query('licitationId') licitationId?: string,
  ) {
    if (status) {
      return this.adjudicationsService.findByStatus(status as any);
    }
    if (quotationId) {
      return this.adjudicationsService.findByQuotation(+quotationId);
    }
    if (licitationId) {
      return this.adjudicationsService.findByLicitation(+licitationId);
    }
    return this.adjudicationsService.findAll(paginationDto);
  }

  @Get('by-client/:clientId')
  @ApiOperation({ summary: 'Obtener adjudicaciones por cliente' })
  @ApiParam({ name: 'clientId', description: 'ID del cliente' })
  @ApiResponse({
    status: 200,
    description: 'Adjudicaciones encontradas',
  })
  findByClient(@Param('clientId') clientId: string) {
    return this.adjudicationsService.findByClient(+clientId);
  }

  @Get('by-product/:productId')
  @ApiOperation({ summary: 'Obtener adjudicaciones por producto' })
  @ApiParam({ name: 'productId', description: 'ID del producto' })
  @ApiResponse({
    status: 200,
    description: 'Adjudicaciones encontradas',
  })
  findByProduct(@Param('productId') productId: string) {
    return this.adjudicationsService.findByProduct(+productId);
  }

  @Get('by-provider/:providerId')
  @ApiOperation({ summary: 'Obtener adjudicaciones por proveedor' })
  @ApiParam({ name: 'providerId', description: 'ID del proveedor' })
  @ApiResponse({
    status: 200,
    description: 'Adjudicaciones encontradas',
  })
  findByProvider(@Param('providerId') providerId: string) {
    return this.adjudicationsService.findByProvider(+providerId);
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
  @ApiOperation({ summary: 'Eliminar adjudicación' })
  @ApiParam({ name: 'id', description: 'ID de la adjudicación' })
  @ApiResponse({
    status: 200,
    description: 'Adjudicación eliminada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Adjudicación no encontrada',
  })
  remove(@Param('id') id: string): Promise<void> {
    return this.adjudicationsService.remove(+id);
  }

  @Patch('quotation-item/:itemId/quantity')
  @ApiOperation({ summary: 'Actualizar cantidad adjudicada de un item' })
  @ApiParam({ name: 'itemId', description: 'ID del item de cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cantidad adjudicada actualizada exitosamente. También actualiza el item de entrega.',
  })
  @ApiResponse({
    status: 404,
    description: 'Item de cotización no encontrado',
  })
  updateAwardedQuantity(
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.adjudicationsService.updateAwardedQuantity(+itemId, quantity);
  }
}
