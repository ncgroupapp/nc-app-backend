import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { Client } from "./entities/client.entity";

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

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

  async findAll(): Promise<Client[]> {
    this.logger.debug("Finding all clients");
    const clients = await this.clientRepository.find({
      order: { createdAt: "DESC" },
    });
    this.logger.log(`Found ${clients.length} clients`);
    return clients;
  }

  async findOne(id: number): Promise<Client> {
    this.logger.debug(`Finding client with ID: ${id}`);
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) {
      this.logger.warn(`Client with ID ${id} not found`);
      throw new NotFoundException(
        `Client with ID ${id} not found. Please verify the ID and try again.`,
      );
    }
    this.logger.debug(`Client found: ${client.identifier}`);
    return client;
  }

  async findByIdentifier(identifier: string): Promise<Client | null> {
    this.logger.debug(`Finding client with identifier: ${identifier}`);
    return this.clientRepository.findOne({ where: { identifier } });
  }

  async update(
    id: number,
    updateClientDto: UpdateClientDto,
  ): Promise<Client> {
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
      this.logger.warn(
        `Client with identifier ${identifier} already exists`,
      );
      throw new ConflictException(
        `Client with identifier ${identifier} already exists. Please use a different identifier.`,
      );
    }
  }
}

