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
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { CertificatesService, MAX_CERTIFICATE_FILE_SIZE } from "./certificates.service";
import { CreateCertificateDto, UpdateCertificateDto } from "./dto/certificate.dto";

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  file: (options?: { limits?: { fileSize?: number } }) => Promise<MultipartFile | undefined>;
};

@ApiTags("certificates")
@Controller("certificates")
@UseInterceptors(TransformInterceptor)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @ApiOperation({ summary: "Certificados con su estado (vigente, por vencer, vencido, sin cargar)" })
  findAll() {
    return this.certificatesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Agregar un certificado propio (además de los que pide RUPE)" })
  create(@Body() dto: CreateCertificateDto) {
    return this.certificatesService.create(dto);
  }

  @Get(":id/file")
  @ApiOperation({ summary: "Archivo del certificado" })
  async file(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const file = await this.certificatesService.getFile(id);
    reply.header("Content-Type", file.mimeType);
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    reply.send(file.fileData);
  }

  @Post(":id/file")
  @ApiOperation({ summary: "Subir o reemplazar el archivo del certificado (PDF o imagen)" })
  @ApiConsumes("multipart/form-data")
  async uploadFile(@Param("id", ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const request = req as MultipartRequest;
    if (typeof request.isMultipart !== "function" || !request.isMultipart()) {
      throw new BadRequestException("Enviá el archivo como multipart/form-data");
    }
    const part = await request.file({ limits: { fileSize: MAX_CERTIFICATE_FILE_SIZE } });
    if (!part) throw new BadRequestException("No se recibió ningún archivo");
    const data = await part.toBuffer();
    if (part.file.truncated) throw new BadRequestException("El archivo supera los 10 MB");
    return this.certificatesService.attachFile(id, { fileName: part.filename, mimeType: part.mimetype, data });
  }

  @Delete(":id/file")
  removeFile(@Param("id", ParseIntPipe) id: number) {
    return this.certificatesService.removeFile(id);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.certificatesService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCertificateDto) {
    return this.certificatesService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.certificatesService.remove(id);
  }
}
