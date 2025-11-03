import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, In } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Provider } from '../providers/entities/provider.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { providerIds, ...productData } = createProductDto;
    
    // Crear el producto sin los providers primero
    const product = this.productRepository.create(productData);
    const savedProduct = await this.productRepository.save(product);
    
    // Si hay providerIds, buscar y asignar los providers
    if (providerIds && providerIds.length > 0) {
      const providers = await this.providerRepository.findBy({
        id: In(providerIds)
      });
      savedProduct.providers = providers;
      return this.productRepository.save(savedProduct);
    }
    
    return savedProduct;
  }

  async findAll(sku?: string): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.providers', 'providers');

    if (sku) {
      queryBuilder.where('product.sku ILIKE :sku', { sku: `%${sku}%` });
    }

    return queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Product | null> {
    return this.productRepository.findOne({ 
      where: { id },
      relations: ['providers']
    });
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    
    const { providerIds, ...updateData } = updateProductDto;
    
    // Actualizar los campos básicos
    Object.assign(product, updateData);
    
    // Si hay providerIds, actualizar los providers
    if (providerIds !== undefined) {
      if (providerIds.length > 0) {
        const providers = await this.providerRepository.findBy({
          id: In(providerIds)
        });
        product.providers = providers;
      } else {
        product.providers = [];
      }
    }
    
    return this.productRepository.save(product);
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.productRepository.remove(product);
  }

  async checkSkuExists(sku: string): Promise<boolean> {
    const product = await this.productRepository.findOne({ where: { sku } });
    return !!product;
  }
}
