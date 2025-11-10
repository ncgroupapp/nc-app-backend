import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

@ApiTags('Cotizaciones')
@Controller('quotation')
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cotización' })
  @ApiResponse({
    status: 201,
    description: 'Cotización creada exitosamente',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una cotización con ese identificador',
  })
  create(@Body() createQuotationDto: CreateQuotationDto) {
    return this.quotationService.create(createQuotationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las cotizaciones' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrar por estado (creada/finalizada)',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: 'Filtrar por ID de cliente',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cotizaciones obtenida exitosamente',
  })
  findAll(@Query('status') status?: string, @Query('clientId') clientId?: string) {
    if (status) {
      return this.quotationService.findByStatus(status);
    }
    if (clientId) {
      return this.quotationService.findByClient(+clientId);
    }
    return this.quotationService.findAll();
  }

  @Get('identifier/:identifier')
  @ApiOperation({ summary: 'Obtener cotización por identificador' })
  @ApiParam({
    name: 'identifier',
    description: 'Identificador único de la cotización',
  })
  @ApiResponse({
    status: 200,
    description: 'Cotización encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada',
  })
  findByIdentifier(@Param('identifier') identifier: string) {
    return this.quotationService.findByIdentifier(identifier);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cotización por ID' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada',
  })
  findOne(@Param('id') id: string) {
    return this.quotationService.findOne(+id);
  }

  @Get(':id/totals')
  @ApiOperation({ summary: 'Obtener totales de una cotización' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Totales calculados exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada',
  })
  getTotals(@Param('id') id: string) {
    return this.quotationService.getTotalsByQuotation(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar cotización' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 200,
    description: 'Cotización actualizada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto con el identificador',
  })
  update(@Param('id') id: string, @Body() updateQuotationDto: UpdateQuotationDto) {
    return this.quotationService.update(+id, updateQuotationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar cotización' })
  @ApiParam({ name: 'id', description: 'ID de la cotización' })
  @ApiResponse({
    status: 204,
    description: 'Cotización eliminada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cotización no encontrada',
  })
  remove(@Param('id') id: string) {
    return this.quotationService.remove(+id);
  }
}
