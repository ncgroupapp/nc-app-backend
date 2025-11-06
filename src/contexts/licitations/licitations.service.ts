import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { CreateLicitationDto } from "./dto/create-licitation.dto";
import { UpdateLicitationDto } from "./dto/update-licitation.dto";
import { Licitation, LicitationStatus } from "./entities/licitation.entity";
import { Client } from "@/contexts/clients/entities/client.entity";
import { Product } from "@/contexts/products/entities/product.entity";

@Injectable()
export class LicitationsService {
  constructor(
    @InjectRepository(Licitation)
    private readonly licitationRepository: Repository<Licitation>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(
    createLicitationDto: CreateLicitationDto,
  ): Promise<Licitation> {
    const { clientId, productIds, startDate, deadlineDate, ...licitationData } =
      createLicitationDto;

    // Validar que la fecha límite sea posterior a la fecha de inicio
    const start = new Date(startDate);
    const deadline = new Date(deadlineDate);
    if (deadline <= start) {
      throw new BadRequestException(
        "Deadline date must be after start date",
      );
    }

    // Validar que el cliente exista
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Validar que los productos existan
    if (productIds.length === 0) {
      throw new BadRequestException("At least one product is required");
    }

    const products = await this.productRepository.findBy({
      id: In(productIds),
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Products with IDs ${missingIds.join(", ")} not found`,
      );
    }

    // Crear la licitación
    const licitation = this.licitationRepository.create({
      ...licitationData,
      startDate: start,
      deadlineDate: deadline,
      client,
      products,
      status: createLicitationDto.status || LicitationStatus.EN_ESPERA,
    });

    return this.licitationRepository.save(licitation);
  }

  async findAll(): Promise<Licitation[]> {
    return this.licitationRepository.find({
      relations: ["client", "products"],
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: number): Promise<Licitation | null> {
    return this.licitationRepository.findOne({
      where: { id },
      relations: ["client", "products"],
    });
  }

  async update(
    id: number,
    updateLicitationDto: UpdateLicitationDto,
  ): Promise<Licitation> {
    const licitation = await this.findOne(id);
    if (!licitation) {
      throw new NotFoundException(`Licitation with ID ${id} not found`);
    }

    const { clientId, productIds, startDate, deadlineDate, ...updateData } =
      updateLicitationDto;

    // Validar fechas si se están actualizando
    if (startDate || deadlineDate) {
      const start = startDate ? new Date(startDate) : licitation.startDate;
      const deadline = deadlineDate
        ? new Date(deadlineDate)
        : licitation.deadlineDate;

      if (deadline <= start) {
        throw new BadRequestException(
          "Deadline date must be after start date",
        );
      }

      if (startDate) licitation.startDate = start;
      if (deadlineDate) licitation.deadlineDate = deadline;
    }

    // Actualizar cliente si se proporciona
    if (clientId !== undefined) {
      const client = await this.clientRepository.findOne({
        where: { id: clientId },
      });
      if (!client) {
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      }
      licitation.client = client;
      licitation.clientId = clientId;
    }

    // Actualizar productos si se proporcionan
    if (productIds !== undefined) {
      if (productIds.length === 0) {
        throw new BadRequestException("At least one product is required");
      }

      const products = await this.productRepository.findBy({
        id: In(productIds),
      });

      if (products.length !== productIds.length) {
        const foundIds = products.map((p) => p.id);
        const missingIds = productIds.filter((id) => !foundIds.includes(id));
        throw new NotFoundException(
          `Products with IDs ${missingIds.join(", ")} not found`,
        );
      }

      licitation.products = products;
    }

    // Actualizar otros campos
    Object.assign(licitation, updateData);

    return this.licitationRepository.save(licitation);
  }

  async remove(id: number): Promise<void> {
    const licitation = await this.findOne(id);
    if (!licitation) {
      throw new NotFoundException(`Licitation with ID ${id} not found`);
    }
    await this.licitationRepository.remove(licitation);
  }
}

