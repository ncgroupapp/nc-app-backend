import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateProviderDto } from "./dto/create-provider.dto";
import { UpdateProviderDto } from "./dto/update-provider.dto";
import { Provider } from "./entities/provider.entity";

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createProviderDto: CreateProviderDto): Promise<Provider> {
    this.logger.log(`Creating provider with RUT: ${createProviderDto.rut}`);
    await this.validateRutNotExists(createProviderDto.rut);

    try {
      const provider = this.providerRepository.create(createProviderDto);
      const savedProvider = await this.providerRepository.save(provider);
      this.logger.log(
        `Provider created successfully with ID: ${savedProvider.id}, RUT: ${savedProvider.rut}`,
      );
      return savedProvider;
    } catch (error) {
      this.logger.error(
        `Failed to create provider with RUT: ${createProviderDto.rut}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findAll(): Promise<Provider[]> {
    this.logger.debug("Finding all providers");
    const providers = await this.providerRepository.find({
      order: { createdAt: "DESC" },
    });
    this.logger.log(`Found ${providers.length} providers`);
    return providers;
  }

  async findOne(id: number): Promise<Provider> {
    this.logger.debug(`Finding provider with ID: ${id}`);
    const provider = await this.providerRepository.findOne({ where: { id } });
    if (!provider) {
      this.logger.warn(`Provider with ID ${id} not found`);
      throw new NotFoundException(
        `Provider with ID ${id} not found. Please verify the ID and try again.`,
      );
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
      await this.validateRutNotExists(updateProviderDto.rut);
    }

    try {
      Object.assign(provider, updateProviderDto);
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
      throw new ConflictException(
        `Provider with RUT ${rut} already exists. Please use a different RUT.`,
      );
    }
  }
}

