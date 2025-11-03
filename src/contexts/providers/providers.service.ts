import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { Provider } from "./entities/provider.entity";

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    const provider = this.providerRepository.create(createProviderDto);
    return this.providerRepository.save(provider);
  }

  async findAll(): Promise<Provider[]> {
    return this.providerRepository.find({
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: number): Promise<Provider | null> {
    return this.providerRepository.findOne({ where: { id } });
  }

  async findByRut(rut: string): Promise<Provider | null> {
    return this.providerRepository.findOne({ where: { rut } });
  }

  async update(
    id: number,
    updateProviderDto: UpdateProviderDto,
  ): Promise<Provider> {
    const provider = await this.findOne(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    Object.assign(provider, updateProviderDto);
    return this.providerRepository.save(provider);
  }

  async remove(id: number): Promise<void> {
    const provider = await this.findOne(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    await this.providerRepository.remove(provider);
  }
}

