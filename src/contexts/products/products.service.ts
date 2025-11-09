import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Provider } from '../providers/entities/provider.entity';

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
    this.logger.log(`Creating product with SKU: ${createProductDto.sku}`);
    const { providerIds, ...productData } = createProductDto;

    try {
      const product = this.productRepository.create(productData);
      const savedProduct = await this.productRepository.save(product);

      if (providerIds && providerIds.length > 0) {
        await this.assignProvidersToProduct(savedProduct, providerIds);
        const result = await this.productRepository.save(savedProduct);
        this.logger.log(
          `Product created successfully with ID: ${result.id}, SKU: ${result.sku}`,
        );
        return result;
      }

      this.logger.log(
        `Product created successfully with ID: ${savedProduct.id}, SKU: ${savedProduct.sku}`,
      );
      return savedProduct;
    } catch (error) {
      this.logger.error(
        `Failed to create product with SKU: ${createProductDto.sku}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findAll(sku?: string): Promise<Product[]> {
    this.logger.debug(`Finding all products${sku ? ` with SKU filter: ${sku}` : ''}`);
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.providers', 'providers');

    if (sku) {
      queryBuilder.where('product.sku ILIKE :sku', { sku: `%${sku}%` });
    }

    const products = await queryBuilder.getMany();
    this.logger.log(`Found ${products.length} products`);
    return products;
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
    this.logger.debug(`Product found: ${product.sku}`);
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
        `Product updated successfully: ID ${id}, SKU: ${updatedProduct.sku}`,
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
        `Product deleted successfully: ID ${id}, SKU: ${product.sku}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete product with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async checkSkuExists(sku: string): Promise<boolean> {
    this.logger.debug(`Checking if SKU exists: ${sku}`);
    const product = await this.productRepository.findOne({ where: { sku } });
    const exists = !!product;
    this.logger.debug(`SKU ${sku} ${exists ? "exists" : "does not exist"}`);
    return exists;
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
