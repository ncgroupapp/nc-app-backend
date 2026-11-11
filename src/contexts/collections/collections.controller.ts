import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UseInterceptors } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { CollectionsService } from "./collections.service";
import { PendingInvoicesDto, SaveCollectionDto, UpdateCollectionDto } from "./dto/collection.dto";

@ApiTags("collections")
@Controller("collections")
@UseInterceptors(TransformInterceptor)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({ summary: "Cobranzas con sus facturas, costo, IVA, ganancia y reparto entre socios" })
  findAll() {
    return this.collectionsService.findAll();
  }

  @Get("pending-invoices")
  @ApiOperation({ summary: "Facturas sin cobrar que se pueden incluir en una cobranza" })
  pendingInvoices(@Query() filters: PendingInvoicesDto) {
    return this.collectionsService.pendingInvoices(filters);
  }

  @Post()
  @ApiOperation({ summary: "Registrar una cobranza; sus facturas quedan como cobradas" })
  create(@Body() dto: SaveCollectionDto) {
    return this.collectionsService.create(dto);
  }

  @Get(":id/pdf")
  @ApiOperation({ summary: "Comprobante PDF de la cobranza" })
  async pdf(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const file = await this.collectionsService.pdf(id);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    reply.send(file.data);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.collectionsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Eliminar la cobranza; sus facturas vuelven a quedar por cobrar" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.collectionsService.remove(id);
  }
}
