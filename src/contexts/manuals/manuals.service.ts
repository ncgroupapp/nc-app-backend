import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { Manual } from './entities/manual.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";

@Injectable()
export class ManualsService {
  constructor(
    @InjectRepository(Manual)
    private readonly manualRepository: Repository<Manual>,
  ) {}

  async create(createManualDto: CreateManualDto) {
    const manual = this.manualRepository.create(createManualDto);
    return this.manualRepository.save(manual);
  }


  async findAll(paginationDto: PaginationDto, search?: string): Promise<PaginatedResult<Manual>> {
    const { page = 1, limit = 10 } = paginationDto;
    const where = search ? { name: ILike(`%${search}%`) } : {};

    const [data, total] = await this.manualRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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

  async findOne(id: number) {
    const manual = await this.manualRepository.findOneBy({ id });
    if (!manual) {
      throw new NotFoundException(`Manual with ID ${id} not found`);
    }
    return manual;
  }

  async update(id: number, updateManualDto: UpdateManualDto) {
    const manual = await this.findOne(id);
    Object.assign(manual, updateManualDto);
    return this.manualRepository.save(manual);
  }

  async remove(id: number) {
    const manual = await this.findOne(id);
    return this.manualRepository.remove(manual);
  }
}

