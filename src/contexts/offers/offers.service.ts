import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { Offer } from "./entities/offer.entity";
import { Product } from "@/contexts/products/entities/product.entity";
import { Provider } from "@/contexts/providers/entities/provider.entity";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { OfferFiltersDto } from "./dto/offer-filters.dto";

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    this.logger.log(
      `Creating offer for product ID: ${createOfferDto.productId}, provider ID: ${createOfferDto.providerId}`,
    );

    const product = await this.validateProductExists(createOfferDto.productId);
    const provider = await this.validateProviderExists(
      createOfferDto.providerId,
    );

    try {
      const offer = this.buildOfferEntity(
        createOfferDto,
        product,
        provider,
      );

      const savedOffer = await this.offerRepository.save(offer);
      this.logger.log(
        `Offer created successfully with ID: ${savedOffer.id}, name: ${savedOffer.name}`,
      );
      return savedOffer;
    } catch (error) {
      this.logger.error(
        `Failed to create offer for product ID: ${createOfferDto.productId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findAll(
    paginationDto: OfferFiltersDto,
    productIdArg?: number,
  ): Promise<PaginatedResult<Offer>> {
    const { page = 1, limit = 10, search, productId, providerId } = paginationDto;
    // Prioritize argument but fallback to DTO
    const finalProductId = productIdArg || productId;

    this.logger.debug(
      `Finding all offers with filters: ${JSON.stringify({ search, productId: finalProductId, providerId })}`,
    );

    const query = this.offerRepository.createQueryBuilder("offer")
      .leftJoinAndSelect("offer.product", "product")
      .leftJoinAndSelect("offer.provider", "provider")
      .orderBy("offer.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (finalProductId) {
      query.andWhere("offer.productId = :productId", { productId: finalProductId });
    }

    if (providerId) {
      query.andWhere("offer.providerId = :providerId", { providerId });
    }

    if (search) {
      query.andWhere(
        "(offer.name ILIKE :search OR product.name ILIKE :search OR provider.name ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    this.logger.log(`Found ${data.length} offers`);
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

  async findOne(id: number): Promise<Offer> {
    this.logger.debug(`Finding offer with ID: ${id}`);
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: ["product", "provider"],
    });
    if (!offer) {
      this.logger.warn(`Offer with ID ${id} not found`);
      throw new NotFoundException(
        `Offer with ID ${id} not found. Please verify the ID and try again.`,
      );
    }
    this.logger.debug(`Offer found: ${offer.name}`);
    return offer;
  }

  async findByProduct(productId: number): Promise<Offer[]> {
    this.logger.debug(`Finding offers for product ID: ${productId}`);
    const offers = await this.offerRepository.find({
      where: { productId },
      relations: ["product", "provider"],
      order: { createdAt: "DESC" },
    });
    this.logger.log(`Found ${offers.length} offers for product ${productId}`);
    return offers;
  }

  async update(
    id: number,
    updateOfferDto: UpdateOfferDto,
  ): Promise<Offer> {
    this.logger.log(`Updating offer with ID: ${id}`);
    const offer = await this.findOne(id);

    const { productId, providerId, deliveryDate, ...fieldsToUpdate } =
      updateOfferDto;

    await this.updateOfferRelations(offer, productId, providerId);

    this.updateOfferFields(offer, fieldsToUpdate);

    if (deliveryDate) {
      offer.deliveryDate = new Date(deliveryDate);
    }

    try {
      const updatedOffer = await this.offerRepository.save(offer);
      this.logger.log(
        `Offer updated successfully: ID ${id}, name: ${updatedOffer.name}`,
      );
      return updatedOffer;
    } catch (error) {
      this.logger.error(
        `Failed to update offer with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting offer with ID: ${id}`);
    const offer = await this.findOne(id);

    try {
      await this.offerRepository.remove(offer);
      this.logger.log(
        `Offer deleted successfully: ID ${id}, name: ${offer.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete offer with ID: ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private async validateProductExists(productId: number): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      this.logger.warn(`Product with ID ${productId} not found`);
      throw new NotFoundException(
        `Product with ID ${productId} not found. Please verify the product ID and try again.`,
      );
    }
    return product;
  }

  private async validateProviderExists(
    providerId: number,
  ): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      this.logger.warn(`Provider with ID ${providerId} not found`);
      throw new NotFoundException(
        `Provider with ID ${providerId} not found. Please verify the provider ID and try again.`,
      );
    }
    return provider;
  }

  private buildOfferEntity(
    createOfferDto: CreateOfferDto,
    product: Product,
    provider: Provider,
  ): Offer {
    return this.offerRepository.create({
      name: createOfferDto.name,
      price: createOfferDto.price,
      deliveryDate: new Date(createOfferDto.deliveryDate),
      quantity: createOfferDto.quantity,
      product,
      provider,
    });
  }

  private updateOfferFields(
    offer: Offer,
    fieldsToUpdate: Omit<UpdateOfferDto, "productId" | "providerId" | "deliveryDate">,
  ): void {
    Object.assign(offer, fieldsToUpdate);
  }

  private async updateOfferRelations(
    offer: Offer,
    productId?: number,
    providerId?: number,
  ): Promise<void> {
    if (productId) {
      const product = await this.validateProductExists(productId);
      offer.product = product;
    }

    if (providerId) {
      const provider = await this.validateProviderExists(providerId);
      offer.provider = provider;
    }
  }
}

