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
  Res,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { QuotationService } from './quotation.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { UpdateItemAwardStatusDto } from './dto/update-item-award-status.dto';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags("quotations")
@Controller("quotation")
@UseInterceptors(TransformInterceptor)
export class QuotationController {
  constructor(
    private readonly quotationService: QuotationService,
    private readonly quotationPdfService: QuotationPdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Crear una nueva cotización" })
  @ApiResponse({
    status: 201,
    description: "Cotización creada exitosamente",
  })
  @ApiResponse({
    status: 409,
    description: "Ya existe una cotización con ese identificador",
  })
  create(@Body() createQuotationDto: CreateQuotationDto) {
    return this.quotationService.create(createQuotationDto);
  }

  @Get()
  @ApiOperation({ summary: "Obtener todas las cotizaciones" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrar por estado (creada/finalizada)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Búsqueda por identificador o nombre de cliente",
  })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Filtrar por ID de cliente",
  })
  @ApiQuery({
    name: "closedOnly",
    required: false,
    description: "Mostrar solo cotizaciones de licitaciones cerradas",
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: "Lista de cotizaciones obtenida exitosamente",
  })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("clientId") clientId?: string,
    @Query("productId") productId?: string,
  ) {
    return this.quotationService.findAll(
      paginationDto,
      search,
      status,
      clientId ? +clientId : undefined,
      productId ? +productId : undefined,
      paginationDto.closedOnly,
    );
  }

  @Get("by-client/:clientId")
  @ApiOperation({ summary: "Obtener cotizaciones por cliente" })
  @ApiParam({ name: "clientId", description: "ID del cliente" })
  @ApiResponse({
    status: 200,
    description: "Cotizaciones encontradas",
  })
  findByClient(@Param("clientId") clientId: string) {
    return this.quotationService.findByClient(+clientId);
  }

  @Get("by-product/:productId")
  @ApiOperation({ summary: "Obtener cotizaciones por producto" })
  @ApiParam({ name: "productId", description: "ID del producto" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrar por estado",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Búsqueda por identificador o nombre de cliente/proveedor",
  })
  @ApiResponse({
    status: 200,
    description: "Cotizaciones encontradas",
  })
  findByProduct(
    @Param("productId") productId: string,
    @Query() paginationDto: PaginationDto,
    @Query("search") search?: string,
    @Query("status") status?: string,
  ) {
    if (Object.keys(paginationDto).length > 0 && (paginationDto.page || paginationDto.limit)) {
      return this.quotationService.findAll(paginationDto, search, status, undefined, +productId);
    }
    return this.quotationService.findByProduct(+productId);
  }

  @Get("by-provider/:providerId")
  @ApiOperation({ summary: "Obtener cotizaciones por proveedor" })
  @ApiParam({ name: "providerId", description: "ID del proveedor" })
  @ApiResponse({
    status: 200,
    description: "Cotizaciones encontradas",
  })
  findByProvider(@Param("providerId") providerId: string) {
    return this.quotationService.findByProvider(+providerId);
  }

  @Get("identifier/:identifier")
  @ApiOperation({ summary: "Obtener cotización por identificador" })
  @ApiParam({
    name: "identifier",
    description: "Identificador único de la cotización",
  })
  @ApiResponse({
    status: 200,
    description: "Cotización encontrada",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  findByIdentifier(@Param("identifier") identifier: string) {
    return this.quotationService.findByIdentifier(identifier);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener cotización por ID" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Cotización encontrada",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  findOne(@Param("id") id: string) {
    return this.quotationService.findOne(+id);
  }

  @Get(":id/totals")
  @ApiOperation({ summary: "Obtener totales de una cotización" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Totales calculados exitosamente",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  getTotals(@Param("id") id: string) {
    return this.quotationService.getTotalsByQuotation(+id);
  }

  // Rutas específicas DEBEN ir antes que las genéricas
  @Patch(":id/item/:itemId/award-status")
  @ApiOperation({ summary: "Actualizar estado de adjudicación de un item de cotización" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiParam({ name: "itemId", description: "ID del item de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Estado de adjudicación actualizado exitosamente",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización o item no encontrado",
  })
  async updateItemAwardStatus(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() updateItemAwardStatusDto: UpdateItemAwardStatusDto,
  ) {
    return this.quotationService.updateItemAwardStatus(
      +id,
      +itemId,
      updateItemAwardStatusDto.awardStatus,
      updateItemAwardStatusDto.awardedQuantity,
    );
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar cotización" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Cotización actualizada exitosamente",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  @ApiResponse({
    status: 409,
    description: "Conflicto con el identificador",
  })
  update(
    @Param("id") id: string,
    @Body() updateQuotationDto: UpdateQuotationDto,
  ) {
    return this.quotationService.update(+id, updateQuotationDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar cotización" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Cotización eliminada exitosamente",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  remove(@Param("id") id: string) {
    return this.quotationService.remove(+id);
  }

  @Get(":id/pdf/preview")
  @ApiOperation({ summary: "Obtener preview del PDF de la cotización en base64" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "Preview del PDF generado exitosamente (base64)",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  async getPdfPreview(@Param("id") id: string) {
    const quotation = await this.quotationService.findOne(+id);
    const pdfBase64 = await this.quotationPdfService.generatePdfBase64(quotation);

    return {
      pdfBase64,
      quotationId: quotation.id,
      quotationIdentifier: quotation.quotationIdentifier,
    };
  }

  @Get(":id/pdf/download")
  @ApiOperation({ summary: "Descargar PDF de la cotización" })
  @ApiParam({ name: "id", description: "ID de la cotización" })
  @ApiResponse({
    status: 200,
    description: "PDF descargado exitosamente",
  })
  @ApiResponse({
    status: 404,
    description: "Cotización no encontrada",
  })
  @ApiResponse({
    status: 500,
    description: "Error al generar el PDF",
  })
  @ApiResponse({
    content: {
      "application/pdf": {
        schema: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async downloadPdf(
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const quotation = await this.quotationService.findOne(+id);
    const pdfBuffer = await this.quotationPdfService.generatePdf(quotation);

    const filename = `cotizacion_${quotation.quotationIdentifier}_${new Date().toISOString().split('T')[0]}.pdf`;

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);

    reply.send(pdfBuffer);
  }
}
