import { timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiConsumes, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { BillingService, IngestResult, MAX_BILLING_FILE_SIZE } from "./billing.service";
import { FilterBillingDocumentsDto, UpdateBillingDocumentDto } from "./dto/billing.dto";
import { BillingDocumentSource } from "./entities/billing-document.entity";

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  files: (options?: { limits?: { fileSize?: number; files?: number } }) => AsyncIterableIterator<MultipartFile>;
};

@ApiTags("billing")
@Controller("billing")
@UseInterceptors(TransformInterceptor)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Used by the folder agent on the office PC: every PDF/XML saved in "Ventas NC GROUP" is posted here.
   * Not behind the JWT middleware; authenticated with the BILLING_SYNC_TOKEN shared secret instead.
   */
  @Post("sync")
  @ApiOperation({ summary: "Subida automática desde la carpeta Ventas NC GROUP (token de sincronización)" })
  @ApiConsumes("multipart/form-data")
  @ApiHeader({ name: "x-sync-token", required: true })
  async sync(@Req() req: FastifyRequest, @Headers("x-sync-token") token?: string) {
    this.assertSyncToken(token);
    return this.ingestRequest(req, BillingDocumentSource.FOLDER);
  }

  @Post("upload")
  @ApiOperation({ summary: "Subir facturas / notas de crédito a mano (PDF o XML)" })
  @ApiConsumes("multipart/form-data")
  async upload(@Req() req: FastifyRequest) {
    return this.ingestRequest(req, BillingDocumentSource.MANUAL);
  }

  @Post("reprocess")
  @ApiOperation({ summary: "Volver a leer los datos de los archivos (por defecto, los marcados para revisar)" })
  reprocess(@Body() body: { ids?: number[] } = {}) {
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0) : undefined;
    return this.billingService.reprocess(ids);
  }

  @Get()
  @ApiOperation({ summary: "Facturas y notas de crédito juntas, con totales por moneda" })
  findAll(@Query() filters: FilterBillingDocumentsDto) {
    return this.billingService.findAll(filters);
  }

  @Get(":id/file")
  @ApiOperation({ summary: "Archivo original (PDF o XML) del documento" })
  async file(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const file = await this.billingService.getFile(id);
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    reply.send(file.fileData);
  }

  @Get(":id/text")
  @ApiOperation({ summary: "Texto leído del archivo (para revisar por qué no se entendió)" })
  rawText(@Param("id", ParseIntPipe) id: number) {
    return this.billingService.getRawText(id);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.billingService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Corregir datos que no se pudieron leer del archivo" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateBillingDocumentDto) {
    return this.billingService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.billingService.remove(id);
  }

  private assertSyncToken(token?: string) {
    const expected = this.configService.get<string>("BILLING_SYNC_TOKEN");
    if (!expected) throw new ServiceUnavailableException("BILLING_SYNC_TOKEN no está configurado en el servidor");
    const given = Buffer.from(token ?? "");
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new UnauthorizedException("Token de sincronización inválido");
    }
  }

  private async ingestRequest(req: FastifyRequest, source: BillingDocumentSource) {
    const request = req as MultipartRequest;
    if (typeof request.isMultipart !== "function" || !request.isMultipart()) {
      throw new BadRequestException("Enviá los archivos como multipart/form-data");
    }

    const results: IngestResult[] = [];
    for await (const part of request.files({ limits: { fileSize: MAX_BILLING_FILE_SIZE, files: 50 } })) {
      const data = await part.toBuffer();
      if (part.file.truncated) {
        results.push({ status: "skipped", fileName: part.filename, reason: "El archivo supera los 10 MB" });
        continue;
      }
      results.push(await this.billingService.ingest({ fileName: part.filename, mimeType: part.mimetype, data }, source));
    }
    if (results.length === 0) throw new BadRequestException("No se recibió ningún archivo");

    return {
      created: results.filter((r) => r.status === "created").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    };
  }
}
