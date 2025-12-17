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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { Client } from "./entities/client.entity";

@ApiTags("clients")
@Controller("clients")
export class ClientsController {
  private readonly logger = new Logger(ClientsController.name);

  constructor(private readonly clientsService: ClientsService) {}

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
  @ApiQuery({
    name: "identifier",
    required: false,
    description: "Filter by identifier/RUT",
    type: String,
  })
  async findAll(@Query("identifier") identifier?: string): Promise<Client[]> {
    this.logger.debug(`GET /clients${identifier ? `?identifier=${identifier}` : ''}`);
    if (identifier) {
      const client = await this.clientsService.findByIdentifier(identifier);
      return client ? [client] : [];
    }
    return this.clientsService.findAll();
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

