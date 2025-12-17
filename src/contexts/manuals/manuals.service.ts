import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreateManualDto } from './dto/create-manual.dto';
import { UpdateManualDto } from './dto/update-manual.dto';
import { Manual } from './entities/manual.entity';

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


  findAll(search?: string) {
    if (search) {
      return this.manualRepository.find({
        where: {
          name: ILike(`%${search}%`),
        },
        order: { createdAt: 'DESC' }
      });
    }
    return this.manualRepository.find({
      order: { createdAt: 'DESC' }
    });
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

