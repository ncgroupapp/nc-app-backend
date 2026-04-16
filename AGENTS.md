# AGENTS.md - Coding Standards

Gentleman Guardian Angel v2.8.1 - Backend Coding Standards

> **Project**: Corna App - Sistema de Gestión de Licitaciones (NestJS Service)
> **Stack**: NestJS, Fastify, TypeORM, PostgreSQL, TypeScript, Vitest
> **Language**: English (code), Spanish (database entities/comments)

---

## Table of Contents

1. [TypeScript Standards](#typescript-standards)
2. [NestJS Architecture](#nestjs-architecture)
3. [Module Structure](#module-structure)
4. [Controller Patterns](#controller-patterns)
5. [Service Layer](#service-layer)
6. [TypeORM & Database](#typeorm--database)
7. [DTOs & Validation](#dtos--validation)
8. [Error Handling](#error-handling)
9. [Authentication & Authorization](#authentication--authorization)
10. [Testing](#testing)
11. [API Documentation](#api-documentation)
12. [Naming Conventions](#naming-conventions)
13. [File Organization](#file-organization)

---

## TypeScript Standards

### Strict Type Safety

```typescript
// ✅ GOOD - Explicit types for all function signatures
interface CreateProductDto {
  name: string
  sku: string
  price: number
  stock: number
  categoryId: string
}

interface ProductResponseDto {
  id: string
  name: string
  sku: string
  price: number
  stock: number
  status: ProductStatus
  category: Category
  createdAt: Date
  updatedAt: Date
}

async function createProduct(dto: CreateProductDto): Promise<ProductResponseDto> {
  const product = this.productRepository.create(dto)
  const saved = await this.productRepository.save(product)
  return this.toResponseDto(saved)
}

// ❌ BAD - Using any
async function createProduct(dto: any): Promise<any> {
  // ...
}
```

### Generic Types

```typescript
// ✅ GOOD - Generic types for reusable patterns
interface PaginationResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Usage
async function findAll(
  page = 1,
  limit = 10,
): Promise<PaginationResponse<Product>> {
  const [data, total] = await this.productRepository.findAndCount({
    skip: (page - 1) * limit,
    take: limit,
  })
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}
```

### Readonly & Immutability

```typescript
// ✅ GOOD - Use readonly for immutable arrays
const PRODUCT_STATUSES = ['active', 'inactive', 'discontinued'] as const
type ProductStatus = typeof PRODUCT_STATUSES[number]

// ✅ GOOD - Use ReadonlyArray for input parameters
function validateProducts(products: ReadonlyArray<Product>): boolean {
  return products.every(p => p.stock >= 0)
}
```

---

## NestJS Architecture

### DDD-Lite Structure

```
src/contexts/
├── {domain}/                     # Bounded context
│   ├── {domain}.module.ts        # Module definition
│   ├── {domain}.controller.ts    # HTTP layer
│   ├── {domain}.service.ts       # Business logic
│   ├── dto/                      # Data Transfer Objects
│   │   ├── create-{entity}.dto.ts
│   │   ├── update-{entity}.dto.ts
│   │   └── filter-{entity}.dto.ts
│   ├── entities/                 # TypeORM entities
│   │   └── {entity}.entity.ts
│   └── enums/                    # Domain enums
│       └── {domain}-status.enum.ts
├── shared/                       # Cross-context shared code
│   ├── dto/                      # Shared DTOs
│   │   └── pagination.dto.ts
│   └── entities/                # Shared entities
│       └── base.entity.ts
└── app/                          # Application-level
    ├── health/                   # Health check
    └── app.module.ts             # Root module
```

### Module Pattern

```typescript
// ✅ GOOD - Standard module structure
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { Product } from './entities/product.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### Dependency Injection

```typescript
// ✅ GOOD - Constructor injection with private readonly
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Product } from './entities/product.entity'

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}
}

// ✅ GOOD - Interface injection for shared dependencies
import { Injectable, Inject } from '@nestjs/common'

export interface IProductsService {
  findAll(): Promise<Product[]>
  findOne(id: string): Promise<Product | null>
}

@Injectable()
export class ProductsService implements IProductsService {
  // ...
}
```

---

## Module Structure

### Context Definition

```typescript
// products.module.ts
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { Product } from './entities/product.entity'
import { BrandsModule } from '../brands/brands.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    BrandsModule, // Import dependencies
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService], // Export for other modules
})
export class ProductsModule {}
```

### Shared Module

```typescript
// shared.module.ts
import { Module, Global } from '@nestjs/common'

@Global() // Makes module available everywhere
@Module({
  providers: [LoggerService, CacheService],
  exports: [LoggerService, CacheService],
})
export class SharedModule {}
```

---

## Controller Patterns

### Standard Controller

```typescript
// ✅ GOOD - Clean controller with decorators
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { FilterProductsDto } from './dto/filter-products.dto'

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto)
  }

  @Get()
  @ApiOperation({ summary: 'Get all products with pagination' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query() filters?: FilterProductsDto,
  ) {
    return this.productsService.findAll({ page, limit, ...filters })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.productsService.remove(id)
  }
}
```

### Response Transformation

```typescript
// ✅ GOOD - Use ResponseFilter for consistent responses
import { UseFilters } from '@nestjs/common'
import { ResponseFilter } from '../common/filters/response.filter'

@Controller('products')
@UseFilters(ResponseFilter)
export class ProductsController {
  // All responses will be wrapped in consistent format
  // { success: true, data: {...}, message: "..." }
}
```

---

## Service Layer

### Service Pattern

```typescript
// ✅ GOOD - Clean service with business logic
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Like } from 'typeorm'
import { Product } from './entities/product.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    // Check if SKU already exists
    const existing = await this.productRepository.findOne({
      where: { sku: createProductDto.sku },
    })

    if (existing) {
      throw new ConflictException('Product with this SKU already exists')
    }

    const product = this.productRepository.create(createProductDto)
    return this.productRepository.save(product)
  }

  async findAll(filters: {
    page: number
    limit: number
    search?: string
    status?: string
    categoryId?: string
  }): Promise<{ data: Product[]; meta: any }> {
    const { page, limit, search, status, categoryId } = filters
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.name = Like(`%${search}%`)
    }
    if (status) {
      where.status = status
    }
    if (categoryId) {
      where.categoryId = categoryId
    }

    const [data, total] = await this.productRepository.findAndCount({
      where,
      skip,
      take: limit,
      relations: ['category', 'brand'],
      order: { createdAt: 'DESC' },
    })

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'brand', 'provider'],
    })

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`)
    }

    return product
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id)

    // Check SKU uniqueness if changed
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.productRepository.findOne({
        where: { sku: updateProductDto.sku },
      })

      if (existing) {
        throw new ConflictException('Product with this SKU already exists')
      }
    }

    Object.assign(product, updateProductDto)
    return this.productRepository.save(product)
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id)

    // Check if product has associated offers
    const offersCount = await this.productRepository
      .createQueryBuilder('product')
      .leftJoin('product.offers', 'offer')
      .where('product.id = :id', { id })
      .getCount()

    if (offersCount > 0) {
      throw new ConflictException(
        'Cannot delete product with associated offers',
      )
    }

    await this.productRepository.remove(product)
  }
}
```

### Transaction Management

```typescript
// ✅ GOOD - Using transactions for multi-step operations
import { DataSource } from 'typeorm'

async createWithDetails(
  createProductDto: CreateProductDto,
  images: Express.Multer.File[],
): Promise<Product> {
  const queryRunner = this.dataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    const product = queryRunner.manager.create(Product, createProductDto)
    const savedProduct = await queryRunner.manager.save(product)

    // Save images
    for (const image of images) {
      const productImage = queryRunner.manager.create(ProductImage, {
        productId: savedProduct.id,
        url: `/uploads/${image.filename}`,
      })
      await queryRunner.manager.save(productImage)
    }

    await queryRunner.commitTransaction()
    return savedProduct
  } catch (error) {
    await queryRunner.rollbackTransaction()
    throw error
  } finally {
    await queryRunner.release()
  }
}
```

---

## TypeORM & Database

### Entity Definition

```typescript
// ✅ GOOD - Complete entity with decorators
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm'
import { Category } from '../../categories/entities/category.entity'
import { Brand } from '../../brands/entities/brand.entity'
import { Offer } from '../../offers/entities/offer.entity'
import { BaseEntity } from '../../shared/entities/base.entity'

@Entity('products')
@Index(['sku'], { unique: true })
@Index(['status'])
@Index(['categoryId'])
export class Product extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'sku', type: 'varchar', length: 50, unique: true })
  sku: string

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number

  @Column({ type: 'int', default: 0 })
  stock: number

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active',
  })
  status: 'active' | 'inactive' | 'discontinued'

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId?: string

  @ManyToOne(() => Brand, (brand) => brand.products)
  @JoinColumn({ name: 'brand_id' })
  brand?: Brand

  @OneToMany(() => Offer, (offer) => offer.product)
  offers: Offer[]
}
```

### Base Entity

```typescript
// ✅ GOOD - Base entity for common fields
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm'

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date
}
```

### Query Builder

```typescript
// ✅ GOOD - Using QueryBuilder for complex queries
async getProductsByProviderWithStats(providerId: string) {
  return this.productRepository
    .createQueryBuilder('product')
    .leftJoinAndSelect('product.offers', 'offer')
    .leftJoinAndSelect('offer.licitation', 'licitation')
    .where('offer.providerId = :providerId', { providerId })
    .andWhere('product.status = :status', { status: 'active' })
    .select([
      'product.id',
      'product.name',
      'product.sku',
      'COUNT(offer.id) as offerCount',
      'AVG(offer.price) as avgPrice',
    ])
    .groupBy('product.id')
    .orderBy('offerCount', 'DESC')
    .getRawMany()
}
```

### Repository Pattern

```typescript
// ✅ GOOD - Custom repository for complex queries
import { EntityRepository, Repository } from 'typeorm'
import { Product } from './product.entity'

@EntityRepository(Product)
export class ProductRepository extends Repository<Product> {
  async findActiveWithLowStock(threshold = 10): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .where('product.stock < :threshold', { threshold })
      .andWhere('product.status = :status', { status: 'active' })
      .orderBy('product.stock', 'ASC')
      .getMany()
  }

  async findBestSellers(limit = 10): Promise<Product[]> {
    return this.createQueryBuilder('product')
      .leftJoin('product.offers', 'offer')
      .leftJoin('offer.adjudications', 'adjudication')
      .select('product.*')
      .addSelect('COUNT(adjudication.id)', 'adjudicationCount')
      .groupBy('product.id')
      .orderBy('adjudicationCount', 'DESC')
      .limit(limit)
      .getRawMany()
  }
}
```

---

## DTOs & Validation

### Create DTO

```typescript
// ✅ GOOD - Complete validation with class-validator
import { ApiProperty } from '@nestjs/swagger'
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
} from 'class-validator'
import { ProductStatus } from '../enums/product-status.enum'

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string

  @ApiProperty({
    description: 'Product SKU (Stock Keeping Unit)',
    pattern: '^[A-Z0-9-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'SKU must contain only uppercase letters, numbers, and hyphens',
  })
  sku: string

  @ApiProperty({ description: 'Product price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number

  @ApiProperty({ description: 'Stock quantity', minimum: 0 })
  @IsNumber()
  @IsInt()
  @Min(0)
  stock: number

  @ApiProperty({
    description: 'Product status',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.ACTIVE

  @ApiProperty({ description: 'Product category ID' })
  @IsUUID()
  categoryId: string

  @ApiProperty({ description: 'Product description', required: false })
  @IsString()
  @MaxLength(2000)
  description?: string
}
```

### Update DTO

```typescript
// ✅ GOOD - Partial update with optional fields
import { PartialType, OmitType } from '@nestjs/mapped-types'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsEnum } from 'class-validator'
import { CreateProductDto } from './create-product.dto'
import { ProductStatus } from '../enums/product-status.enum'

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['sku'] as const),
) {
  @ApiPropertyOptional({
    description: 'Product status',
    enum: ProductStatus,
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus
}
```

### Filter DTO

```typescript
// ✅ GOOD - Filter DTO with pagination
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsInt, IsEnum, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ProductStatus } from '../enums/product-status.enum'

export class FilterProductsDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: 'Items per page', default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string
}
```

### Global Validation Pipe

```typescript
// ✅ GOOD - Global validation pipe configuration in main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
)
```

---

## Error Handling

### Custom Exceptions

```typescript
// ✅ GOOD - Domain-specific exceptions
import { HttpException, HttpStatus } from '@nestjs/common'

export class ProductNotFoundException extends HttpException {
  constructor(productId: string) {
    super(
      `Product with ID ${productId} not found`,
      HttpStatus.NOT_FOUND,
    )
  }
}

export class DuplicateSkuException extends HttpException {
  constructor(sku: string) {
    super(
      `Product with SKU ${sku} already exists`,
      HttpStatus.CONFLICT,
    )
  }
}

export class InsufficientStockException extends HttpException {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`,
      HttpStatus.BAD_REQUEST,
    )
  }
}
```

### Global Exception Filter

```typescript
// ✅ GOOD - Centralized error handling
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error'

    // Log error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : '',
    )

    // Send response
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
```

### Response Wrapper

```typescript
// ✅ GOOD - Consistent response format
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  success: boolean
  data: T
  message?: string
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    )
  }
}
```

---

## Authentication & Authorization

### JWT Guard

```typescript
// ✅ GOOD - JWT authentication guard
import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      'isPublic',
      [context.getHandler(), context.getClass()],
    )

    if (isPublic) return true

    return super.canActivate(context)
  }
}
```

### Role Guard

```typescript
// ✅ GOOD - Role-based authorization
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

export const ROLES_KEY = 'roles'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (!requiredRoles) return true

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.some((role) => user.role === role)
  }
}

// Usage decorator
import { SetMetadata } from '@nestjs/common'

export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)

// Controller usage
@Get()
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
findAll() { /* ... */ }
```

---

## Testing

### Unit Test

```typescript
// ✅ GOOD - Service unit test with mocked dependencies
import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { ProductsService } from './products.service'
import { Product } from './entities/product.entity'
import { CreateProductDto } from './dto/create-product.dto'
import { mockRepository } from '../../test/utils/mock-repository'

describe('ProductsService', () => {
  let service: ProductsService
  let repository: Repository<Product>

  const mockProduct = {
    id: '1',
    name: 'Test Product',
    sku: 'TEST-001',
    price: 100,
    stock: 10,
    status: 'active',
    categoryId: 'cat-1',
  } as Product

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepository,
        },
      ],
    }).compile()

    service = module.get<ProductsService>(ProductsService)
    repository = module.get<Repository<Product>>(getRepositoryToken(Product))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create a new product', async () => {
      const createDto: CreateProductDto = {
        name: 'New Product',
        sku: 'NEW-001',
        price: 150,
        stock: 5,
        status: 'active',
        categoryId: 'cat-1',
      }

      mockRepository.findOne.mockResolvedValue(null)
      mockRepository.create.mockReturnValue(createDto)
      mockRepository.save.mockResolvedValue({ id: '2', ...createDto })

      const result = await service.create(createDto)

      expect(result).toEqual({ id: '2', ...createDto })
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { sku: createDto.sku },
      })
      expect(repository.create).toHaveBeenCalledWith(createDto)
      expect(repository.save).toHaveBeenCalled()
    })

    it('should throw ConflictException if SKU already exists', async () => {
      const createDto: CreateProductDto = {
        name: 'New Product',
        sku: 'TEST-001', // Existing SKU
        price: 150,
        stock: 5,
        status: 'active',
        categoryId: 'cat-1',
      }

      mockRepository.findOne.mockResolvedValue(mockProduct)

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockProduct)

      const result = await service.findOne('1')

      expect(result).toEqual(mockProduct)
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['category', 'brand', 'provider'],
      })
    })

    it('should throw NotFoundException if product not found', async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException)
    })
  })
})
```

### E2E Test

```typescript
// ✅ GOOD - E2E test with Supertest
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from './../src/app.module'
import { setupTestDatabase } from './test-database'

describe('Products (e2e)', () => {
  let app: INestApplication
  let authToken: string

  beforeAll(async () => {
    await setupTestDatabase()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    await app.init()

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' })

    authToken = loginResponse.body.access_token
  })

  afterAll(async () => {
    await app.close()
  })

  describe('/products (POST)', () => {
    it('should create a product', () => {
      return request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product',
          sku: 'TEST-E2E-001',
          price: 100,
          stock: 10,
          status: 'active',
          categoryId: 'cat-1',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true)
          expect(res.body.data.name).toBe('Test Product')
          expect(res.body.data.sku).toBe('TEST-E2E-001')
        })
    })

    it('should return 400 for invalid SKU format', () => {
      return request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product',
          sku: 'invalid sku!', // Invalid format
          price: 100,
          stock: 10,
          status: 'active',
          categoryId: 'cat-1',
        })
        .expect(400)
    })
  })

  describe('/products (GET)', () => {
    it('should return paginated products', () => {
      return request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true)
          expect(Array.isArray(res.body.data)).toBe(true)
          expect(res.body.meta).toBeDefined()
          expect(res.body.meta.page).toBeDefined()
          expect(res.body.meta.limit).toBeDefined()
          expect(res.body.meta.total).toBeDefined()
        })
    })
  })
})
```

---

## API Documentation

### Swagger Setup

```typescript
// ✅ GOOD - Complete Swagger setup in main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

const config = new DocumentBuilder()
  .setTitle('Corna App API')
  .setDescription('Sistema de Gestión de Licitaciones API')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT token',
      in: 'header',
    },
    'JWT-auth',
  )
  .addTag('products', 'Product management')
  .addTag('clients', 'Client management')
  .addTag('licitations', 'Licitations management')
  .build()

const document = SwaggerModule.createDocument(app, config)
SwaggerModule.setup('api', app, document)
```

### Controller Documentation

```typescript
// ✅ GOOD - Detailed API documentation
@ApiTags('products')
@Controller('products')
export class ProductsController {
  @Post()
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a new product with the provided data. SKU must be unique.',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: Product,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    schema: {
      example: {
        success: false,
        statusCode: 400,
        message: [
          'name must not be empty',
          'sku must contain only uppercase letters, numbers, and hyphens',
        ],
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - SKU already exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto)
  }
}
```

---

## Naming Conventions

### File Names

- **Modules**: `{domain}.module.ts` → `products.module.ts`
- **Controllers**: `{domain}.controller.ts` → `products.controller.ts`
- **Services**: `{domain}.service.ts` → `products.service.ts`
- **Entities**: `{entity}.entity.ts` → `product.entity.ts`
- **DTOs**: `{action}-{entity}.dto.ts` → `create-product.dto.ts`, `update-product.dto.ts`

### Variable/Function Names

```typescript
// ✅ GOOD - camelCase for variables and functions
const productId = '123'
const productService = new ProductsService()
async function findAllProducts() { }

// ✅ GOOD - PascalCase for classes and interfaces
class ProductsService { }
interface ProductDto { }
type ProductStatus = 'active' | 'inactive'

// ✅ GOOD - UPPER_CASE for constants
const MAX_RETRY_COUNT = 3
const DEFAULT_PAGE_SIZE = 10

// ✅ GOOD - snake_case for database columns
@Entity('products')
export class Product {
  @Column({ name: 'category_id' })
  categoryId: string
}
```

### Database Table Names

```typescript
// ✅ GOOD - Plural, lowercase table names
@Entity('products')     // ✅
@Entity('clients')      // ✅
@Entity('licitations')   // ✅

// ❌ BAD - Singular or mixed case
@Entity('Product')       // ❌
@Entity('Client_Table')  // ❌
```

---

## File Organization

### Path Aliases

```typescript
// tsconfig.json paths
{
  "paths": {
    "@/src/*": ["src/*"],
    "@/app/*": ["src/app/*"],
    "@/contexts/*": ["src/contexts/*"],
    "@/shared/*": ["src/contexts/shared/*"],
    "@/tests/*": ["tests/*"]
  }
}

// Usage in code
import { ProductsService } from '@/src/contexts/products/products.service'
import { BaseController } from '@/src/app/common/base.controller'
import { PaginationDto } from '@/src/contexts/shared/dto/pagination.dto'
```

### Import Order

```typescript
// ✅ GOOD - Consistent import order
// 1. Node.js built-ins
import { join } from 'path'
import { readFileSync } from 'fs'

// 2. External packages
import { Controller, Get, Post, Body } from '@nestjs/common'
import { IsString, IsNotEmpty } from 'class-validator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'

// 3. Internal modules
import { ProductsModule } from '../products/products.module'

// 4. Same-context imports
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { Product } from './entities/product.entity'

// 5. Type imports (if separate)
import type { ProductFilter } from './types'
```

---

## Quick Reference

### Must-Do Checklist Before Commit

- [ ] No `any` types (or documented exceptions)
- [ ] All DTOs have complete validation
- [ ] All endpoints have Swagger documentation
- [ ] Error handling with proper HTTP status codes
- [ ] Database queries use proper indexes
- [ ] Sensitive data never logged
- [ ] Unit tests for critical business logic
- [ ] E2E tests for API endpoints

### Git Hooks (Husky)

Pre-commit hooks run:
- ESLint
- Conventional commits validation
- TypeScript type checking
- Typos checking
- Tests execution

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`

---

**Version**: 2.8.1
**Last Updated**: 2026-04-03
**Maintainer**: Corna App Team
