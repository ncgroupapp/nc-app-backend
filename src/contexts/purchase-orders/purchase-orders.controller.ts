import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { FilterPurchaseOrdersDto, SavePurchaseOrderDto, UpdatePurchaseOrderDto } from "./dto/purchase-order.dto";
import { MAX_PURCHASE_ORDER_FILE_SIZE, PurchaseOrdersService } from "./purchase-orders.service";

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  file: (options?: { limits?: { fileSize?: number } }) => Promise<MultipartFile | undefined>;
};

@ApiTags("purchase-orders")
@Controller("purchase-orders")
@UseInterceptors(TransformInterceptor)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @ApiOperation({ summary: "Órdenes de compra con sus licitaciones, facturas y remitos vinculados" })
  findAll(@Query() filters: FilterPurchaseOrdersDto) {
    return this.purchaseOrdersService.findAll(filters);
  }

  @Get("metrics")
  @ApiOperation({ summary: "Totales de las órdenes de compra para las tarjetas de arriba" })
  metrics() {
    return this.purchaseOrdersService.metrics();
  }

  @Post("read")
  @ApiOperation({ summary: "Leer número, fecha, cliente, total y licitación del PDF de una orden (sin guardarla)" })
  @ApiConsumes("multipart/form-data")
  async read(@Req() req: FastifyRequest) {
    const request = req as MultipartRequest;
    if (typeof request.isMultipart !== "function" || !request.isMultipart()) {
      throw new BadRequestException("Enviá el archivo como multipart/form-data");
    }
    const part = await request.file({ limits: { fileSize: MAX_PURCHASE_ORDER_FILE_SIZE } });
    if (!part) throw new BadRequestException("No se recibió ningún archivo");
    const data = await part.toBuffer();
    if (part.file.truncated) throw new BadRequestException("El archivo supera los 15 MB");
    return this.purchaseOrdersService.read({ fileName: part.filename, data });
  }

  @Post()
  create(@Body() dto: SavePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Get(":id/file")
  @ApiOperation({ summary: "PDF de la orden de compra" })
  async file(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const file = await this.purchaseOrdersService.getFile(id);
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    reply.send(file.fileData);
  }

  @Post(":id/file")
  @ApiOperation({ summary: "Subir o reemplazar el PDF de la orden de compra" })
  @ApiConsumes("multipart/form-data")
  async uploadFile(@Param("id", ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const request = req as MultipartRequest;
    if (typeof request.isMultipart !== "function" || !request.isMultipart()) {
      throw new BadRequestException("Enviá el archivo como multipart/form-data");
    }
    const part = await request.file({ limits: { fileSize: MAX_PURCHASE_ORDER_FILE_SIZE } });
    if (!part) throw new BadRequestException("No se recibió ningún archivo");
    const data = await part.toBuffer();
    if (part.file.truncated) throw new BadRequestException("El archivo supera los 15 MB");
    return this.purchaseOrdersService.attachFile(id, { fileName: part.filename, mimeType: part.mimetype, data });
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.purchaseOrdersService.remove(id);
  }
}
