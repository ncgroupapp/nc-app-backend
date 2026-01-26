import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { CreateLicitationDto, ProductWithQuantityDto } from "./dto/create-licitation.dto";
import { UpdateLicitationDto } from "./dto/update-licitation.dto";
import { Licitation, LicitationStatus } from "./entities/licitation.entity";
import { LicitationProduct } from "./entities/licitation-product.entity";
import { Client } from "@/contexts/clients/entities/client.entity";
import { Product } from "@/contexts/products/entities/product.entity";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";

@Injectable()
export class LicitationsService {
  private readonly logger = new Logger(LicitationsService.name);

  constructor(
    @InjectRepository(Licitation)
    private readonly licitationRepository: Repository<Licitation>,
    @InjectRepository(LicitationProduct)
    private readonly licitationProductRepository: Repository<LicitationProduct>,
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
    const { clientId, products, productIds, startDate, deadlineDate, ...licitationData } =
      createLicitationDto;

    const start = new Date(startDate);
    const deadline = new Date(deadlineDate);
    this.validateDateRange(start, deadline, startDate, deadlineDate);

    const client = await this.validateClientExists(clientId);
    
    // Determine products to add - support both new format (products) and legacy (productIds)
    const productsWithQuantity = this.normalizeProductsInput(products, productIds);
    await this.validateProductsExist(productsWithQuantity.map(p => p.productId));

    try {
      // Create and save licitation first
      const licitation = this.licitationRepository.create({
        ...licitationData,
        startDate: start,
        deadlineDate: deadline,
        client,
        clientId,
        status: createLicitationDto.status || LicitationStatus.PENDING,
      });

      const savedLicitation = await this.licitationRepository.save(licitation);

      // Create licitation products with quantities
      const licitationProducts = productsWithQuantity.map(({ productId, quantity }) =>
        this.licitationProductRepository.create({
          licitationId: savedLicitation.id,
          productId,
          quantity: quantity || 1,
        })
      );

      await this.licitationProductRepository.save(licitationProducts);

      this.logger.log(
        `Licitation created successfully with ID: ${savedLicitation.id}, call number: ${savedLicitation.callNumber}`,
      );
      
      // Return with loaded relations
      return this.findOne(savedLicitation.id);
    } catch (error) {
      this.logger.error(
        `Failed to create licitation with call number: ${createLicitationDto.callNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private normalizeProductsInput(
    products?: ProductWithQuantityDto[],
    productIds?: number[],
  ): ProductWithQuantityDto[] {
    // If products array is provided, use it
    if (products && products.length > 0) {
      return products;
    }
    
    // Otherwise, convert legacy productIds to products with quantity 1
    if (productIds && productIds.length > 0) {
      return productIds.map(productId => ({ productId, quantity: 1 }));
    }

    return [];
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Licitation>> {
    const { page = 1, limit = 10, search, status, clientId } = paginationDto;
    this.logger.debug(`Finding all licitations with filters: search=${search}, status=${status}, clientId=${clientId}`);
    
    const queryBuilder = this.licitationRepository
      .createQueryBuilder("licitation")
      .leftJoinAndSelect("licitation.client", "client")
      .leftJoinAndSelect("licitation.licitationProducts", "licitationProducts")
      .leftJoinAndSelect("licitationProducts.product", "product")
      .orderBy("licitation.createdAt", "DESC");

    if (search) {
      queryBuilder.andWhere(
        "(licitation.callNumber ILIKE :search OR licitation.internalNumber ILIKE :search OR client.name ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    if (status) {
      queryBuilder.andWhere("licitation.status = :status", { status });
    }

    if (clientId) {
      queryBuilder.andWhere("licitation.clientId = :clientId", { clientId });
    }

    const [data, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    this.logger.log(`Found ${data.length} licitations (total: ${total})`);
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

  async findOne(id: number): Promise<Licitation> {
    this.logger.debug(`Finding licitation with ID: ${id}`);
    const licitation = await this.licitationRepository.findOne({
      where: { id },
      relations: ["client", "licitationProducts", "licitationProducts.product"],
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

    const { clientId, products, productIds, startDate, deadlineDate, ...fieldsToUpdate } =
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

    if (clientId !== undefined) {
      const client = await this.validateClientExists(clientId);
      licitation.client = client;
      licitation.clientId = clientId;
    }

    // Handle products update
    const productsWithQuantity = this.normalizeProductsInput(products, productIds);
    if (productsWithQuantity.length > 0) {
      await this.validateProductsExist(productsWithQuantity.map(p => p.productId));
      
      // Remove existing products
      await this.licitationProductRepository.delete({ licitationId: id });
      
      // Add new products
      const licitationProducts = productsWithQuantity.map(({ productId, quantity }) =>
        this.licitationProductRepository.create({
          licitationId: id,
          productId,
          quantity: quantity || 1,
        })
      );
      await this.licitationProductRepository.save(licitationProducts);
    }

    this.updateLicitationFields(licitation, fieldsToUpdate);

    try {
      await this.licitationRepository.save(licitation);
      this.logger.log(
        `Licitation updated successfully: ID ${id}, call number: ${licitation.callNumber}`,
      );
      return this.findOne(id);
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

  private updateLicitationFields(
    licitation: Licitation,
    fieldsToUpdate: Partial<UpdateLicitationDto>,
  ): void {
    Object.assign(licitation, fieldsToUpdate);
  }
}
