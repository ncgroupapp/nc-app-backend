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
    this.logger.log(
      `Creating licitation with call number: ${createLicitationDto.callNumber}, internal number: ${createLicitationDto.internalNumber}`,
    );
    const { clientId, productIds, startDate, deadlineDate, ...licitationData } =
      createLicitationDto;

    const start = new Date(startDate);
    const deadline = new Date(deadlineDate);
    this.validateDateRange(start, deadline, startDate, deadlineDate);

    const client = await this.validateClientExists(clientId);
    const products = await this.validateProductsExist(productIds);

    try {
      const licitation = this.buildLicitationEntity(
        licitationData,
        start,
        deadline,
        client,
        products,
        createLicitationDto.status,
      );

      const savedLicitation = await this.licitationRepository.save(licitation);
      this.logger.log(
        `Licitation created successfully with ID: ${savedLicitation.id}, call number: ${savedLicitation.callNumber}`,
      );
      return savedLicitation;
    } catch (error) {
      this.logger.error(
        `Failed to create licitation with call number: ${createLicitationDto.callNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
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

  async findOne(id: number): Promise<Licitation> {
    this.logger.debug(`Finding licitation with ID: ${id}`);
    const licitation = await this.licitationRepository.findOne({
      where: { id },
      relations: ["client", "products"],
    });
    if (!licitation) {
      this.logger.warn(`Licitation with ID ${id} not found`);
      throw new NotFoundException(
        `Licitation with ID ${id} not found. Please verify the ID and try again.`,
      );
    }
    this.logger.debug(`Licitation found: ${licitation.callNumber}`);
    return licitation;
  }

  async update(
    id: number,
    updateLicitationDto: UpdateLicitationDto,
  ): Promise<Licitation> {
    this.logger.log(`Updating licitation with ID: ${id}`);
    const licitation = await this.findOne(id);

    const { clientId, productIds, startDate, deadlineDate, ...fieldsToUpdate } =
      updateLicitationDto;

    if (startDate || deadlineDate) {
      const start = startDate ? new Date(startDate) : licitation.startDate;
      const deadline = deadlineDate
        ? new Date(deadlineDate)
        : licitation.deadlineDate;
      this.validateDateRange(
        start,
        deadline,
        startDate || licitation.startDate.toISOString(),
        deadlineDate || licitation.deadlineDate.toISOString(),
      );
      if (startDate) licitation.startDate = start;
      if (deadlineDate) licitation.deadlineDate = deadline;
    }

    await this.updateLicitationRelations(licitation, clientId, productIds);
    this.updateLicitationFields(licitation, fieldsToUpdate);

    try {
      const updatedLicitation = await this.licitationRepository.save(licitation);
      this.logger.log(
        `Licitation updated successfully: ID ${id}, call number: ${updatedLicitation.callNumber}`,
      );
      return updatedLicitation;
    } catch (error) {
      this.logger.error(
        `Failed to update licitation with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting licitation with ID: ${id}`);
    const licitation = await this.findOne(id);

    try {
      await this.licitationRepository.remove(licitation);
      this.logger.log(
        `Licitation deleted successfully: ID ${id}, call number: ${licitation.callNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete licitation with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private validateDateRange(
    startDate: Date,
    deadlineDate: Date,
    startDateString: string,
    deadlineDateString: string,
  ): void {
    if (deadlineDate <= startDate) {
      this.logger.warn(
        `Invalid date range: deadline ${deadlineDateString} must be after start ${startDateString}`,
      );
      throw new BadRequestException(
        `Invalid date range: deadline date (${deadlineDateString}) must be after start date (${startDateString})`,
      );
    }
  }

  private async validateClientExists(clientId: number): Promise<Client> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
    });
    if (!client) {
      this.logger.warn(`Client with ID ${clientId} not found`);
      throw new NotFoundException(
        `Client with ID ${clientId} not found. Please verify the client ID and try again.`,
      );
    }
    return client;
  }

  private async validateProductsExist(
    productIds: number[],
  ): Promise<Product[]> {
    if (productIds.length === 0) {
      this.logger.warn("No products provided for licitation");
      throw new BadRequestException(
        "At least one product is required to create a licitation",
      );
    }

    const products = await this.productRepository.findBy({
      id: In(productIds),
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(
        `Products with IDs [${missingIds.join(", ")}] not found. Found products: [${foundIds.join(", ")}]`,
      );
      throw new NotFoundException(
        `Products with IDs [${missingIds.join(", ")}] not found. Please verify the product IDs and try again.`,
      );
    }

    return products;
  }

  private buildLicitationEntity(
    licitationData: Omit<
      CreateLicitationDto,
      "clientId" | "productIds" | "startDate" | "deadlineDate"
    >,
    startDate: Date,
    deadlineDate: Date,
    client: Client,
    products: Product[],
    status?: LicitationStatus,
  ): Licitation {
    return this.licitationRepository.create({
      ...licitationData,
      startDate,
      deadlineDate,
      client,
      products,
      status: status || LicitationStatus.PENDING,
    });
  }

  private updateLicitationFields(
    licitation: Licitation,
    fieldsToUpdate: Partial<UpdateLicitationDto>,
  ): void {
    Object.assign(licitation, fieldsToUpdate);
  }

  private async updateLicitationRelations(
    licitation: Licitation,
    clientId?: number,
    productIds?: number[],
  ): Promise<void> {
    if (clientId !== undefined) {
      const client = await this.validateClientExists(clientId);
      licitation.client = client;
      licitation.clientId = clientId;
    }

    if (productIds !== undefined) {
      const products = await this.validateProductsExist(productIds);
      licitation.products = products;
    }
  }
}

