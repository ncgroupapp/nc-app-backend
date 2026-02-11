import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeliveriesService, UpdateDeliveryItemDto, CreateInvoiceDto } from './deliveries.service';
import { PaginationDto } from '../shared/dto/pagination.dto';

@ApiTags('Deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las entregas' })
  @ApiResponse({ status: 200, description: 'Lista de entregas' })
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.deliveriesService.findAll(paginationDto);
  }

  // IMPORTANTE: Rutas con path específico deben ir ANTES de rutas con parámetros
  @Get('licitation/:licitationId')
  @ApiOperation({ summary: 'Obtener entrega por licitación' })
  @ApiResponse({ status: 200, description: 'Entrega de la licitación' })
  async findByLicitation(@Param('licitationId', ParseIntPipe) licitationId: number) {
    return this.deliveriesService.findByLicitation(licitationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una entrega por ID' })
  @ApiResponse({ status: 200, description: 'Entrega encontrada' })
  @ApiResponse({ status: 404, description: 'Entrega no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.deliveriesService.findOne(id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'Obtener items de una entrega' })
  @ApiResponse({ status: 200, description: 'Lista de items' })
  async getItems(@Param('id', ParseIntPipe) id: number) {
    return this.deliveriesService.getDeliveryItems(id);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Actualizar estado de un item de entrega' })
  @ApiResponse({ status: 200, description: 'Item actualizado' })
  @ApiResponse({ status: 404, description: 'Item no encontrado' })
  async updateItemStatus(
    @Param('id', ParseIntPipe) deliveryId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateDto: UpdateDeliveryItemDto,
  ) {
    return this.deliveriesService.updateItemStatus(deliveryId, itemId, updateDto);
  }

  @Get(':id/invoices')
  @ApiOperation({ summary: 'Obtener facturas de una entrega' })
  @ApiResponse({ status: 200, description: 'Lista de facturas' })
  async getInvoices(@Param('id', ParseIntPipe) id: number) {
    return this.deliveriesService.getInvoices(id);
  }

  @Post(':id/invoices')
  @ApiOperation({ summary: 'Agregar factura a una entrega' })
  @ApiResponse({ status: 201, description: 'Factura agregada' })
  @ApiResponse({ status: 404, description: 'Entrega no encontrada' })
  async addInvoice(
    @Param('id', ParseIntPipe) deliveryId: number,
    @Body() invoiceDto: CreateInvoiceDto,
  ) {
    return this.deliveriesService.addInvoice(deliveryId, invoiceDto);
  }
}
