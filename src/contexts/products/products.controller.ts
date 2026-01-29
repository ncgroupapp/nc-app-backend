import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, ParseIntPipe, Query, Logger, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { Product } from './entities/product.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { TransformInterceptor } from "../shared/interceptors/transform.interceptor";

@ApiTags('products')
@Controller('products')
@UseInterceptors(TransformInterceptor)
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully', type: Product })
  async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    this.logger.log(`POST /products - Creating product: ${createProductDto.name}`);
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products with optional filters' })
  @ApiResponse({ status: 200, description: 'List of products', type: [Product] })
  async findAll(@Query() filters: FilterProductsDto): Promise<PaginatedResult<Product>> {
    this.logger.debug(`GET /products with filters: ${JSON.stringify(filters)}`);
    return this.productsService.findAll(filters);
  }



  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiResponse({ status: 200, description: 'Product found', type: Product })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    this.logger.debug(`GET /products/${id}`);
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully', type: Product })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    this.logger.log(`PATCH /products/${id} - Updating product`);
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    this.logger.log(`DELETE /products/${id} - Deleting product`);
    await this.productsService.remove(id);
  }
}
