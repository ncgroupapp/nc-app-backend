import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
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
  private readonly logger = new Logger(LicitationsService.name);

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
    this.logger.log(`Creating licitation with call number: ${createLicitationDto.callNumber}, internal number: ${createLicitationDto.internalNumber}`);
    const { clientId, productIds, startDate, deadlineDate, ...licitationData } =
      createLicitationDto;

    // Validar que la fecha límite sea posterior a la fecha de inicio
    const start = new Date(startDate);
    const deadline = new Date(deadlineDate);
    if (deadline <= start) {
      this.logger.warn(`Invalid dates: deadline ${deadlineDate} is not after start ${startDate}`);
      throw new BadRequestException(
        "Deadline date must be after start date",
      );
    }

    // Validar que el cliente exista
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client) {
      this.logger.warn(`Client with ID ${clientId} not found`);
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Validar que los productos existan
    if (productIds.length === 0) {
      this.logger.warn("No products provided for licitation");
      throw new BadRequestException("At least one product is required");
    }

    const products = await this.productRepository.findBy({
      id: In(productIds),
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(`Products with IDs ${missingIds.join(", ")} not found`);
      throw new NotFoundException(
        `Products with IDs ${missingIds.join(", ")} not found`,
      );
    }

    try {
      // Crear la licitación
      const licitation = this.licitationRepository.create({
        ...licitationData,
        startDate: start,
        deadlineDate: deadline,
        client,
        products,
        status: createLicitationDto.status || LicitationStatus.PENDING,
      });

      const savedLicitation = await this.licitationRepository.save(licitation);
      this.logger.log(`Licitation created successfully with ID: ${savedLicitation.id}, call number: ${savedLicitation.callNumber}`);
      return savedLicitation;
    } catch (error) {
      this.logger.error(`Failed to create licitation with call number: ${createLicitationDto.callNumber}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async findAll(): Promise<Licitation[]> {
    this.logger.debug("Finding all licitations");
    const licitations = await this.licitationRepository.find({
      relations: ["client", "products"],
      order: { createdAt: "DESC" },
    });
    this.logger.log(`Found ${licitations.length} licitations`);
    return licitations;
  }

  async findOne(id: number): Promise<Licitation | null> {
    this.logger.debug(`Finding licitation with ID: ${id}`);
    const licitation = await this.licitationRepository.findOne({
      where: { id },
      relations: ["client", "products"],
    });
    if (!licitation) {
      this.logger.warn(`Licitation with ID ${id} not found`);
    } else {
      this.logger.debug(`Licitation found: ${licitation.callNumber}`);
    }
    return licitation;
  }

  async update(
    id: number,
    updateLicitationDto: UpdateLicitationDto,
  ): Promise<Licitation> {
    this.logger.log(`Updating licitation with ID: ${id}`);
    const licitation = await this.findOne(id);
    if (!licitation) {
      this.logger.warn(`Licitation with ID ${id} not found for update`);
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
        this.logger.warn(`Invalid dates: deadline ${deadlineDate || licitation.deadlineDate} is not after start ${startDate || licitation.startDate}`);
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
        this.logger.warn(`Client with ID ${clientId} not found`);
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      }
      licitation.client = client;
      licitation.clientId = clientId;
    }

    // Actualizar productos si se proporcionan
    if (productIds !== undefined) {
      if (productIds.length === 0) {
        this.logger.warn("No products provided for licitation update");
        throw new BadRequestException("At least one product is required");
      }

      const products = await this.productRepository.findBy({
        id: In(productIds),
      });

      if (products.length !== productIds.length) {
        const foundIds = products.map((p) => p.id);
        const missingIds = productIds.filter((id) => !foundIds.includes(id));
        this.logger.warn(`Products with IDs ${missingIds.join(", ")} not found`);
        throw new NotFoundException(
          `Products with IDs ${missingIds.join(", ")} not found`,
        );
      }

      licitation.products = products;
    }

    try {
      // Actualizar otros campos
      Object.assign(licitation, updateData);
      const updatedLicitation = await this.licitationRepository.save(licitation);
      this.logger.log(`Licitation updated successfully: ID ${id}, call number: ${updatedLicitation.callNumber}`);
      return updatedLicitation;
    } catch (error) {
      this.logger.error(`Failed to update licitation with ID: ${id}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting licitation with ID: ${id}`);
    const licitation = await this.findOne(id);
    if (!licitation) {
      this.logger.warn(`Licitation with ID ${id} not found for deletion`);
      throw new NotFoundException(`Licitation with ID ${id} not found`);
    }
    
    try {
      await this.licitationRepository.remove(licitation);
      this.logger.log(`Licitation deleted successfully: ID ${id}, call number: ${licitation.callNumber}`);
    } catch (error) {
      this.logger.error(`Failed to delete licitation with ID: ${id}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}

