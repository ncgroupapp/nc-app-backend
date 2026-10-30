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
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { RemitosService } from "./remitos.service";
import { RemitosPdfService } from "./remitos-pdf.service";
import { CreateRemitoDto, FilterRemitosDto, UpdateRemitoDto } from "./dto/remito.dto";
import { CreateShippingGuideDto, UpdateShippingGuideDto } from "./dto/shipping-guide.dto";
import { formatRemitoNumber } from "./remito-pdf.template";

@ApiTags("remitos")
@Controller("remitos")
@UseInterceptors(TransformInterceptor)
export class RemitosController {
  constructor(
    private readonly remitosService: RemitosService,
    private readonly pdfService: RemitosPdfService,
  ) {}

  // Rutas de guías antes que ":id"
  @Get("guides")
  @ApiOperation({ summary: "Listar guías de envío" })
  findGuides(@Query("search") search?: string) {
    return this.remitosService.findGuides(search);
  }

  @Get("guides/pdf")
  @ApiOperation({ summary: "PDF de guías de envío (dos por hoja A4 horizontal). ids=1,2,3" })
  async guidesPdf(@Query("ids") ids: string, @Res({ passthrough: true }) reply: FastifyReply) {
    const parsed = (ids ?? "").split(",").map((id) => Number(id.trim())).filter((id) => Number.isInteger(id) && id > 0);
    if (parsed.length === 0) throw new BadRequestException("Indicá al menos una guía (ids=1,2)");
    const guides = await this.remitosService.findGuidesByIds(parsed.slice(0, 50));
    const pdf = await this.pdfService.generateGuidesPdf(guides);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="guias-envio.pdf"`);
    reply.send(pdf);
  }

  @Post("guides")
  @ApiOperation({ summary: "Crear guía de envío" })
  createGuide(@Body() dto: CreateShippingGuideDto) {
    return this.remitosService.createGuide(dto);
  }

  @Patch("guides/:id")
  @ApiOperation({ summary: "Editar guía de envío" })
  updateGuide(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateShippingGuideDto) {
    return this.remitosService.updateGuide(id, dto);
  }

  @Delete("guides/:id")
  @ApiOperation({ summary: "Eliminar guía de envío" })
  async removeGuide(@Param("id", ParseIntPipe) id: number) {
    await this.remitosService.removeGuide(id);
    return { id };
  }

  @Get("draft/licitation/:licitationId")
  @ApiOperation({ summary: "Datos sugeridos para un remito a partir de una licitación" })
  draftFromLicitation(@Param("licitationId", ParseIntPipe) licitationId: number) {
    return this.remitosService.draftFromLicitation(licitationId);
  }

  @Get()
  @ApiOperation({ summary: "Listar remitos" })
  findAll(@Query() filters: FilterRemitosDto) {
    return this.remitosService.findAll(filters);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener remito" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.remitosService.findOne(id);
  }

  @Get(":id/pdf")
  @ApiOperation({ summary: "PDF del remito" })
  async pdf(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const remito = await this.remitosService.findOne(id);
    const pdf = await this.pdfService.generateRemitoPdf(remito);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="remito-${formatRemitoNumber(remito.number)}.pdf"`);
    reply.send(pdf);
  }

  @Post()
  @ApiOperation({ summary: "Crear remito (número correlativo automático)" })
  create(@Body() dto: CreateRemitoDto) {
    return this.remitosService.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Editar remito, marcar entregado o anular" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRemitoDto) {
    return this.remitosService.update(id, dto);
  }
}
