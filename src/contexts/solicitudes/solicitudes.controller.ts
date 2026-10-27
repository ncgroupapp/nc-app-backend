import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { FastifyReply, FastifyRequest } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import type { JwtPayload } from "../shared/types/auth.types";
import { FilterSolicitudesDto } from "./dto/filter-solicitudes.dto";
import { UpdateSolicitudDto } from "./dto/update-solicitud.dto";
import { Solicitud } from "./entities/solicitud.entity";
import { MailAccountView, MailSyncService } from "./mail-sync.service";
import { LicitacionDraft, LicitacionDraftService } from "./licitacion-draft.service";
import { SolicitudesService, SolicitudesSummary } from "./solicitudes.service";

@ApiTags("solicitudes")
@Controller("solicitudes")
@UseInterceptors(TransformInterceptor)
export class SolicitudesController {
  private readonly logger = new Logger(SolicitudesController.name);

  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly mailSyncService: MailSyncService,
    private readonly licitacionDraftService: LicitacionDraftService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Listado de solicitudes recibidas por mail" })
  async findAll(@Query() filters: FilterSolicitudesDto): Promise<PaginatedResult<Solicitud>> {
    return this.solicitudesService.findAll(filters);
  }

  @Get("summary")
  @ApiOperation({ summary: "Cantidad de solicitudes por estado y sin leer" })
  async getSummary(): Promise<SolicitudesSummary> {
    return this.solicitudesService.getSummary();
  }

  // --- Mailbox connection ---

  @Get("mail/accounts")
  @ApiOperation({ summary: "Casillas de correo conectadas y estado de la sincronización" })
  async listAccounts(): Promise<{ configured: boolean; accounts: MailAccountView[] }> {
    return { configured: this.mailSyncService.isConfigured(), accounts: await this.mailSyncService.listAccounts() };
  }

  @Get("mail/connect")
  @ApiOperation({ summary: "URL de Google para autorizar el acceso de solo lectura a una casilla" })
  getConnectUrl(@Req() req: FastifyRequest, @Query("email") email?: string): { url: string } {
    const user = (req as FastifyRequest & { user?: JwtPayload }).user;
    return { url: this.mailSyncService.getConnectUrl(user?.sub ?? "unknown", email) };
  }

  /** Google redirects the browser here (no Authorization header; protected by the signed state). */
  @Get("mail/callback")
  @ApiOperation({ summary: "Retorno de Google después de autorizar la casilla" })
  async oauthCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const target = await this.mailSyncService.handleCallback(code, state, error);
    await reply.status(302).header("Location", target).send();
  }

  @Post("mail/accounts/:id/sync")
  @ApiOperation({ summary: "Revisar la casilla ahora, sin esperar a la próxima sincronización" })
  async syncNow(@Param("id", ParseIntPipe) id: number): Promise<{ imported: number; updated: number }> {
    this.logger.log(`POST /solicitudes/mail/accounts/${id}/sync`);
    return this.mailSyncService.syncAccount(id);
  }

  @Delete("mail/accounts/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Desconectar la casilla y revocar el permiso de Google" })
  async disconnect(@Param("id", ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`DELETE /solicitudes/mail/accounts/${id}`);
    await this.mailSyncService.disconnect(id);
  }

  @Get("attachments/:id/download")
  @ApiOperation({ summary: "Descargar un adjunto (se lee de Gmail en el momento)" })
  async downloadAttachment(@Param("id", ParseIntPipe) id: number, @Res() reply: FastifyReply): Promise<void> {
    const file = await this.mailSyncService.downloadAttachment(id);
    await reply
      .header("Content-Type", file.mimeType)
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .send(file.data);
  }

  // --- Single solicitud ---

  @Get(":id")
  @ApiOperation({ summary: "Detalle de una solicitud con el hilo de mails y adjuntos" })
  @ApiResponse({ status: 404, description: "Solicitud no encontrada" })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<Solicitud> {
    return this.solicitudesService.findOne(id);
  }

  @Get(":id/licitacion-draft")
  @ApiOperation({ summary: "Datos leídos del mail y sus PDF para armar la licitación (cierre y productos)" })
  async getLicitacionDraft(@Param("id", ParseIntPipe) id: number): Promise<LicitacionDraft> {
    return this.licitacionDraftService.buildDraft(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Cambiar estado, responsable o notas internas" })
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSolicitudDto): Promise<Solicitud> {
    this.logger.log(`PATCH /solicitudes/${id}`);
    return this.solicitudesService.update(id, dto);
  }
}
