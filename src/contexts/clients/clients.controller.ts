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
  ParseIntPipe,
  Query,
  Logger,
  UseInterceptors,
  BadRequestException,
  Req,
  Res,
} from "@nestjs/common";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { ClientsService, MAX_CLIENT_LOGO_BYTES } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { Client } from "./entities/client.entity";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";
import { PaginationDto } from "../shared/dto/pagination.dto";

@ApiTags("clients")
@Controller("clients")
@UseInterceptors(TransformInterceptor)
export class ClientsController {
  private readonly logger = new Logger(ClientsController.name);

  constructor(private readonly clientsService: ClientsService) {}

  @Get(":id/logo")
  @ApiOperation({ summary: "Logo del cliente (PNG o JPG)" })
  async getLogo(@Param("id", ParseIntPipe) id: number, @Res({ passthrough: true }) reply: FastifyReply) {
    const logo = await this.clientsService.getLogo(id);
    reply.header("Content-Type", logo.mimeType);
    reply.header("Cache-Control", "private, max-age=86400");
    reply.send(logo.data);
  }

  @Post(":id/logo")
  @ApiOperation({ summary: "Subir o reemplazar el logo del cliente (PNG o JPG, hasta 2 MB)" })
  async uploadLogo(@Param("id", ParseIntPipe) id: number, @Req() req: FastifyRequest) {
    const request = req as FastifyRequest & {
      isMultipart?: () => boolean;
      file: (options?: { limits?: { fileSize?: number } }) => Promise<MultipartFile | undefined>;
    };
    if (typeof request.isMultipart !== "function" || !request.isMultipart()) {
      throw new BadRequestException("Enviá el logo como multipart/form-data");
    }
    const part = await request.file({ limits: { fileSize: MAX_CLIENT_LOGO_BYTES } });
    if (!part) throw new BadRequestException("No se recibió ningún archivo");
    const data = await part.toBuffer();
    if (part.file.truncated) throw new BadRequestException("El logo no puede superar los 2 MB");
    return this.clientsService.setLogo(id, data);
  }

  @Delete(":id/logo")
  @ApiOperation({ summary: "Quitar el logo del cliente" })
  removeLogo(@Param("id", ParseIntPipe) id: number) {
    return this.clientsService.removeLogo(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new client" })
  @ApiResponse({
    status: 201,
    description: "Client created successfully",
    type: Client,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Client with identifier already exists" })
  async create(@Body() createClientDto: CreateClientDto): Promise<Client> {
    this.logger.log(`POST /clients - Creating client with identifier: ${createClientDto.identifier}`);
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all clients" })
  @ApiResponse({
    status: 200,
    description: "List of clients",
    type: [Client],
  })
  async findAll(@Query() filterDto: PaginationDto): Promise<PaginatedResult<Client>> {
    this.logger.debug(`GET /clients with filters: ${JSON.stringify(filterDto)}`);
    return this.clientsService.findAll(filterDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a client by ID" })
  @ApiResponse({
    status: 200,
    description: "Client found",
    type: Client,
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<Client> {
    this.logger.debug(`GET /clients/${id}`);
    return this.clientsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a client" })
  @ApiResponse({
    status: 200,
    description: "Client updated successfully",
    type: Client,
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  @ApiResponse({ status: 409, description: "Client with identifier already exists" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ): Promise<Client> {
    this.logger.log(`PATCH /clients/${id} - Updating client`);
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a client" })
  @ApiResponse({
    status: 200,
    description: "Client deleted successfully",
  })
  @ApiResponse({ status: 404, description: "Client not found" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`DELETE /clients/${id} - Deleting client`);
    await this.clientsService.remove(id);
  }
}

