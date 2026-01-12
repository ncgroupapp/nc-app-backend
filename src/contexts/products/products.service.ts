import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Provider } from '../providers/entities/provider.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";

import { FilterProductsDto } from './dto/filter-products.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    this.logger.log(`Creating product: ${createProductDto.name}`);
    const { providerIds, ...productData } = createProductDto;

    try {
      const product = this.productRepository.create(productData);
      const savedProduct = await this.productRepository.save(product);

      if (providerIds && providerIds.length > 0) {
        await this.assignProvidersToProduct(savedProduct, providerIds);
        const result = await this.productRepository.save(savedProduct);
        this.logger.log(
          `Product created successfully with ID: ${result.id}`,
        );
        return result;
      }

      this.logger.log(
        `Product created successfully with ID: ${savedProduct.id}`,
      );
      return savedProduct;
    } catch (error) {
      this.logger.error(
        `Failed to create product: ${createProductDto.name}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }


  async findAll(filters?: FilterProductsDto, paginationDto?: PaginationDto): Promise<PaginatedResult<Product>> {
    const { page = 1, limit = 10 } = paginationDto || {};

    this.logger.debug(`Finding products with filters: ${JSON.stringify(filters || {})}`);
    
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.providers', 'providers')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters) {
      // Text filters with partial match (ILIKE for case-insensitive)
      if (filters.name) {
        queryBuilder.andWhere('product.name ILIKE :name', { name: `%${filters.name}%` });
      }

      if (filters.brand) {
        queryBuilder.andWhere('product.brand ILIKE :brand', { brand: `%${filters.brand}%` });
      }

      if (filters.model) {
        queryBuilder.andWhere('product.model ILIKE :model', { model: `%${filters.model}%` });
      }

      if (filters.details) {
        queryBuilder.andWhere('product.details ILIKE :details', { details: `%${filters.details}%` });
      }

      if (filters.description) {
        queryBuilder.andWhere('product.description ILIKE :description', { description: `%${filters.description}%` });
      }

      if (filters.observations) {
        queryBuilder.andWhere('product.observations ILIKE :observations', { observations: `%${filters.observations}%` });
      }

      if (filters.equipment) {
        queryBuilder.andWhere('product.equipment ILIKE :equipment', { equipment: `%${filters.equipment}%` });
      }

      if (filters.chassis) {
        queryBuilder.andWhere('product.chassis ILIKE :chassis', { chassis: `%${filters.chassis}%` });
      }

      if (filters.motor) {
        queryBuilder.andWhere('product.motor ILIKE :motor', { motor: `%${filters.motor}%` });
      }

      // Price range filters
      if (filters.minPrice !== undefined) {
        queryBuilder.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
      }

      if (filters.maxPrice !== undefined) {
        queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
      }

      // Stock filter
      if (filters.minStock !== undefined) {
        queryBuilder.andWhere('product.stock >= :minStock', { minStock: filters.minStock });
      }

      // Provider filter - products that have at least one of the specified providers
      if (filters.providerIds && filters.providerIds.length > 0) {
        queryBuilder.andWhere('providers.id IN (:...providerIds)', { providerIds: filters.providerIds });
      }

      // General search across multiple fields
      if (filters.search) {
        queryBuilder.andWhere(
          '(product.name ILIKE :search OR product.brand ILIKE :search OR product.model ILIKE :search OR product.description ILIKE :search)',
          { search: `%${filters.search}%` }
        );
      }
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    this.logger.log(`Found ${data.length} products`);
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

  async findOne(id: number): Promise<Product> {
    this.logger.debug(`Finding product with ID: ${id}`);
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ["providers"],
    });

    if (!product) {
      this.logger.warn(`Product with ID ${id} not found`);
      throw new NotFoundException(
        `Product with ID ${id} not found. Please verify the ID and try again.`,
      );
    }
    this.logger.debug(`Product found: ${product.name}`);
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    this.logger.log(`Updating product with ID: ${id}`);
    const product = await this.findOne(id);

    try {
      const { providerIds, ...updateData } = updateProductDto;

      Object.assign(product, updateData);

      if (providerIds !== undefined) {
        await this.updateProductProviders(product, providerIds);
      }

      const updatedProduct = await this.productRepository.save(product);
      this.logger.log(
        `Product updated successfully: ID ${id}`,
      );
      return updatedProduct;
    } catch (error) {
      this.logger.error(
        `Failed to update product with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting product with ID: ${id}`);
    const product = await this.findOne(id);

    try {
      await this.productRepository.remove(product);
      this.logger.log(
        `Product deleted successfully: ID ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete product with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }



  private async validateProvidersExist(
    providerIds: number[],
  ): Promise<Provider[]> {
    const providers = await this.providerRepository.findBy({
      id: In(providerIds),
    });

    if (providers.length !== providerIds.length) {
      const foundIds = providers.map((p) => p.id);
      const missingIds = providerIds.filter((id) => !foundIds.includes(id));
      this.logger.warn(
        `Providers with IDs [${missingIds.join(", ")}] not found. Found providers: [${foundIds.join(", ")}]`,
      );
      throw new NotFoundException(
        `Providers with IDs [${missingIds.join(", ")}] not found. Please verify the provider IDs and try again.`,
      );
    }

    return providers;
  }

  private async assignProvidersToProduct(
    product: Product,
    providerIds: number[],
  ): Promise<void> {
    this.logger.debug(
      `Associating ${providerIds.length} providers to product ${product.id}`,
    );
    const providers = await this.validateProvidersExist(providerIds);
    product.providers = providers;
  }

  private async updateProductProviders(
    product: Product,
    providerIds: number[],
  ): Promise<void> {
    if (providerIds.length > 0) {
      this.logger.debug(
        `Updating ${providerIds.length} providers for product ${product.id}`,
      );
      const providers = await this.validateProvidersExist(providerIds);
      product.providers = providers;
    } else {
      this.logger.debug(`Removing all providers from product ${product.id}`);
      product.providers = [];
    }
  }
}
