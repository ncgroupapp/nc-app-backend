import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { Provider } from "./entities/provider.entity";
import { Product } from "../products/entities/product.entity";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { ERROR_MESSAGES } from "../shared/constants/error-messages.constants";

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    this.logger.log(`Creating provider: ${createProviderDto.name}`);

    if (createProviderDto.rut) {
      const normalizedRut = this.normalizeRut(createProviderDto.rut);
      // await this.validateRutNotExists(normalizedRut);
      createProviderDto.rut = normalizedRut;
    }

    try {
      const provider: Provider = this.providerRepository.create(createProviderDto as Provider);
      const savedProvider = await this.providerRepository.save(provider);
      this.logger.log(
        `Provider created successfully with ID: ${savedProvider.id}, RUT: ${savedProvider.rut}`,
      );
      return savedProvider;
    } catch (error) {
      this.logger.error(
        `Failed to create provider: ${createProviderDto.name}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findAll(paginationDto: PaginationDto, filters?: { brand?: string }): Promise<PaginatedResult<Provider>> {
    const { page = 1, limit = 10, search } = paginationDto;
    this.logger.debug(`Finding providers with page: ${page}, limit: ${limit}${search ? `, search: ${search}` : ''}${filters?.brand ? `, brand: ${filters.brand}` : ''}`);

    const queryBuilder = this.providerRepository.createQueryBuilder('provider')
      .orderBy('provider.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.where(
        "(provider.name ILIKE :search OR provider.rut ILIKE :search OR provider.country ILIKE :search OR array_to_string(provider.brands, ',') ILIKE :search)",
        { search: `%${search}%` }
      );
    }

    if (filters?.brand) {
      queryBuilder.andWhere("array_to_string(provider.brands, ',') ILIKE :brand", { brand: `%${filters.brand}%` });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    this.logger.log(`Found ${data.length} providers`);
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

  async findOne(id: number): Promise<Provider> {
    this.logger.debug(`Finding provider with ID: ${id}`);
    const provider = await this.providerRepository.findOne({ 
      where: { id },
    });

    if (!provider) {
      this.logger.warn(`Provider with ID ${id} not found`);
      throw new NotFoundException(ERROR_MESSAGES.PROVIDERS.NOT_FOUND(id));
    }
    this.logger.debug(`Provider found: ${provider.rut}`);
    return provider;
  }

  async findByRut(rut: string): Promise<Provider | null> {
    this.logger.debug(`Finding provider with RUT: ${rut}`);
    return this.providerRepository.findOne({ where: { rut } });
  }

  async update(
    id: number,
    updateProviderDto: UpdateProviderDto,
  ): Promise<Provider> {
    this.logger.log(`Updating provider with ID: ${id}`);
    const provider = await this.findOne(id);

    if (updateProviderDto.rut && updateProviderDto.rut !== provider.rut) {
      const normalizedRut = this.normalizeRut(updateProviderDto.rut);
      // this.validateRutChecksum(normalizedRut);
      // await this.validateRutNotExists(normalizedRut);
      updateProviderDto.rut = normalizedRut;
    }

    try {
      const updateData: any = { ...updateProviderDto };
      Object.assign(provider, updateData);
      const updatedProvider = await this.providerRepository.save(provider);
      this.logger.log(
        `Provider updated successfully: ID ${id}, RUT: ${updatedProvider.rut}`,
      );
      return updatedProvider;
    } catch (error) {
      this.logger.error(
        `Failed to update provider with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting provider with ID: ${id}`);
    const provider = await this.findOne(id);

    // Check if provider has associated products
    const associatedProductsCount = await this.productRepository
      .createQueryBuilder("product")
      .innerJoin("product.providers", "provider")
      .where("provider.id = :providerId", { providerId: id })
      .getCount();

    if (associatedProductsCount > 0) {
      this.logger.warn(
        `Cannot delete provider ${id} because it has ${associatedProductsCount} associated products`,
      );
      throw new ConflictException(ERROR_MESSAGES.PROVIDERS.HAS_ASSOCIATED_PRODUCTS);
    }

    try {
      await this.providerRepository.remove(provider);
      this.logger.log(
        `Provider deleted successfully: ID ${id}, RUT: ${provider.rut}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete provider with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async validateRutNotExists(rut: string): Promise<void> {
    const existingProvider = await this.findByRut(rut);
    if (existingProvider) {
      this.logger.warn(`Provider with RUT ${rut} already exists`);
      throw new ConflictException(ERROR_MESSAGES.PROVIDERS.ALREADY_EXISTS(rut));
    }
  }

  /**
   * Normaliza el RUT uruguayo a formato estándar (XXXXXXXX-X)
   * Remueve puntos y espacios, mantiene el guion y el dígito verificador
   */
  private normalizeRut(rut: string): string {
    const cleanRut = rut
      .trim()
      .toUpperCase()
      .replace(/\./g, "")
      .replace(/\s/g, "");

    if (!cleanRut.includes("-")) {
      const numberPart = cleanRut.slice(0, -1);
      const checkDigit = cleanRut.slice(-1);
      return `${numberPart}-${checkDigit}`;
    }

    const [numberPart, checkDigit] = cleanRut.split("-");
    return `${numberPart}-${checkDigit}`;
  }

  private validateRutChecksum(rut: string): void {
    const cleanRut = rut.replace(/[^0-9]/g, "");

    if (cleanRut.length !== 12) {
      throw new BadRequestException(ERROR_MESSAGES.PROVIDERS.INVALID_RUT_LENGTH);
    }

    const digits = cleanRut.split("").map(Number);
    const verifier = digits.pop();
    const factors = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let total = 0;
    for (const [i, factor] of factors.entries()) {
      total += digits[i] * factor;
    }

    const remainder = total % 11;
    let computedVerifier = 11 - remainder;

    if (computedVerifier === 11) {
      computedVerifier = 0;
    }

    // Nota: El caso de que dé 10 se asume como inválido para este algoritmo estándar
    if (computedVerifier === 10) {
      throw new BadRequestException(ERROR_MESSAGES.PROVIDERS.INVALID_RUT);
    }

    if (computedVerifier !== verifier) {
      throw new BadRequestException(ERROR_MESSAGES.PROVIDERS.INVALID_RUT_DIGIT);
    }
  }
}

