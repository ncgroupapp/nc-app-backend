import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { Client } from "./entities/client.entity";

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async create(createClientDto: CreateClientDto): Promise<Client> {
    const existingClient = await this.findByIdentifier(
      createClientDto.identifier,
    );
    if (existingClient) {
      throw new ConflictException(
        `Client with identifier ${createClientDto.identifier} already exists`,
      );
    }

    const client = this.clientRepository.create(createClientDto);
    return this.clientRepository.save(client);
  }

  async findAll(): Promise<Client[]> {
    return this.clientRepository.find({
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: number): Promise<Client | null> {
    return this.clientRepository.findOne({ where: { id } });
  }

  async findByIdentifier(identifier: string): Promise<Client | null> {
    return this.clientRepository.findOne({ where: { identifier } });
  }

  async update(
    id: number,
    updateClientDto: UpdateClientDto,
  ): Promise<Client> {
    const client = await this.findOne(id);
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    if (updateClientDto.identifier && updateClientDto.identifier !== client.identifier) {
      const existingClient = await this.findByIdentifier(
        updateClientDto.identifier,
      );
      if (existingClient) {
        throw new ConflictException(
          `Client with identifier ${updateClientDto.identifier} already exists`,
        );
      }
    }

    Object.assign(client, updateClientDto);
    return this.clientRepository.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    await this.clientRepository.remove(client);
  }
}

