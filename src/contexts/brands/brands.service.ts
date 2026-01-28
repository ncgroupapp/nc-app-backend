import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from './entities/brand.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { FilterBrandsDto } from './dto/filter-brands.dto';
import { PaginatedResult } from '@/shared/interfaces/paginated-result.interface';
import { BrandModel } from './entities/brand-model.entity';
import { PaginationDto } from '../shared/dto/pagination.dto';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    @InjectRepository(Brand)
    private readonly brandRepository: Repository<Brand>,
    @InjectRepository(BrandModel)
    private readonly brandModelRepository: Repository<BrandModel>,
  ) {}

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    const brand = this.brandRepository.create(createBrandDto);
    return await this.brandRepository.save(brand);
  }

  async findAll(filters: PaginationDto): Promise<PaginatedResult<Brand>> {
    const { page = 1, limit = 10, search } = filters;

    const queryBuilder = this.brandRepository
      .createQueryBuilder('brand')
      .leftJoinAndSelect('brand.models', 'models')
      .skip((page - 1) * limit)
      .take(limit);

   if (search) {
    queryBuilder.andWhere('brand.name ILIKE :search OR models.name ILIKE :search', { search: `%${search}%` });
   }

    const [data, total] = await queryBuilder.getManyAndCount();

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

  async findOne(id: number): Promise<Brand> {
    const brand = await this.brandRepository.findOne({
      where: { id },
      relations: ['models'],
    });
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
    return brand;
  }

  async update(id: number, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    // Note: This basic update might create duplicate models if they are sent without IDs (which DTO doesn't have yet)
    // For a robust implementation, DTOs should include IDs for existing models.
    const brand = await this.brandRepository.preload({
      id,
      ...updateBrandDto,
    });
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
    return await this.brandRepository.save(brand);
  }

  async remove(id: number): Promise<void> {
    const result = await this.brandRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
  }
}
