import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, Brackets } from "typeorm";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { Client } from "./entities/client.entity";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { ERROR_MESSAGES } from "../shared/constants/error-messages.constants";

export const MAX_CLIENT_LOGO_BYTES = 2 * 1024 * 1024;

/** PNG or JPEG by their first bytes (the formats the quotation PDF can embed) */
export function logoMimeType(data: Buffer): "image/png" | "image/jpeg" | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}

@Injectable()
export class ClientsService implements OnModuleInit {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  /** Adds the logo columns in databases created before them (migrations are not run on deploy). */
  async onModuleInit(): Promise<void> {
    try {
      await this.dataSource.query(`
        ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logoData" bytea;
        ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logoMimeType" character varying(50);
        ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "logoUpdatedAt" TIMESTAMP;
      `);
    } catch (error) {
      this.logger.error("Could not ensure client logo columns", error instanceof Error ? error.stack : String(error));
    }
  }

  async setLogo(id: number, data: Buffer): Promise<Client> {
    await this.findOne(id);
    if (data.length === 0) throw new BadRequestException("El archivo está vacío");
    if (data.length > MAX_CLIENT_LOGO_BYTES) throw new BadRequestException("El logo no puede superar los 2 MB");
    const mimeType = logoMimeType(data);
    if (!mimeType) throw new BadRequestException("El logo tiene que ser una imagen PNG o JPG");
    await this.clientRepository.update(id, { logoData: data, logoMimeType: mimeType, logoUpdatedAt: new Date() });
    return this.findOne(id);
  }

  async removeLogo(id: number): Promise<Client> {
    await this.findOne(id);
    await this.clientRepository.update(id, { logoData: null, logoMimeType: null, logoUpdatedAt: null });
    return this.findOne(id);
  }

  async getLogo(id: number): Promise<{ data: Buffer; mimeType: string }> {
    const client = await this.clientRepository
      .createQueryBuilder("client")
      .select(["client.id", "client.logoMimeType"])
      .addSelect("client.logoData")
      .where("client.id = :id", { id })
      .getOne();
    if (!client) throw new NotFoundException(ERROR_MESSAGES.CLIENTS.NOT_FOUND(id));
    if (!client.logoData) throw new NotFoundException("El cliente no tiene logo");
    return { data: client.logoData, mimeType: client.logoMimeType ?? "image/png" };
  }

  async create(createClientDto: CreateClientDto): Promise<Client> {
    this.logger.log(
      `Creating client with identifier: ${createClientDto.identifier}`,
    );
    await this.validateIdentifierNotExists(createClientDto.identifier);

    try {
      const client = this.clientRepository.create(createClientDto);
      const savedClient = await this.clientRepository.save(client);
      this.logger.log(
        `Client created successfully with ID: ${savedClient.id}, identifier: ${savedClient.identifier}`,
      );
      return savedClient;
    } catch (error) {
      this.logger.error(
        `Failed to create client with identifier: ${createClientDto.identifier}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findAll(filterDto: PaginationDto): Promise<PaginatedResult<Client>> {
    const { page = 1, limit = 10, search } = filterDto;
    this.logger.debug(
      `Finding clients with filters: ${JSON.stringify(filterDto)}`,
    );
    
    const queryBuilder = this.clientRepository
      .createQueryBuilder("client")
      .orderBy("client.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.where(
        'client.name ILIKE :search OR client.identifier ILIKE :search OR client.contacts::text ILIKE :search',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    this.logger.log(`Found ${data.length} clients`);
    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
        limit,
      },
    };
  }

  async findOne(id: number): Promise<Client> {
    this.logger.debug(`Finding client with ID: ${id}`);
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      this.logger.warn(`Client with ID ${id} not found`);
      throw new NotFoundException(ERROR_MESSAGES.CLIENTS.NOT_FOUND(id));
    }
    this.logger.debug(`Client found: ${client.identifier}`);
    return client;
  }

  async findByIdentifier(identifier: string): Promise<Client | null> {
    this.logger.debug(`Finding client with identifier: ${identifier}`);
    return this.clientRepository.findOne({ where: { identifier } });
  }

  async update(id: number, updateClientDto: UpdateClientDto): Promise<Client> {
    this.logger.log(`Updating client with ID: ${id}`);
    const client = await this.findOne(id);

    if (
      updateClientDto.identifier &&
      updateClientDto.identifier !== client.identifier
    ) {
      await this.validateIdentifierNotExists(updateClientDto.identifier);
    }

    try {
      Object.assign(client, updateClientDto);
      const updatedClient = await this.clientRepository.save(client);
      this.logger.log(
        `Client updated successfully: ID ${id}, identifier: ${updatedClient.identifier}`,
      );
      return updatedClient;
    } catch (error) {
      this.logger.error(
        `Failed to update client with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting client with ID: ${id}`);
    const client = await this.findOne(id);

    try {
      await this.clientRepository.remove(client);
      this.logger.log(
        `Client deleted successfully: ID ${id}, identifier: ${client.identifier}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete client with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async validateIdentifierNotExists(identifier: string): Promise<void> {
    const existingClient = await this.findByIdentifier(identifier);
    if (existingClient) {
      this.logger.warn(`Client with identifier ${identifier} already exists`);
      throw new ConflictException(ERROR_MESSAGES.CLIENTS.IDENTIFIER_ALREADY_EXISTS(identifier));
    }
  }
}

