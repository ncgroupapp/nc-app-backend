import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { Offer } from "./entities/offer.entity";
import { Product } from "@/contexts/products/entities/product.entity";
import { Provider } from "@/contexts/providers/entities/provider.entity";

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    const product = await this.productRepository.findOne({
      where: { id: createOfferDto.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID ${createOfferDto.productId} not found`,
      );
    }

    const provider = await this.providerRepository.findOne({
      where: { id: createOfferDto.providerId },
    });
    if (!provider) {
      throw new NotFoundException(
        `Provider with ID ${createOfferDto.providerId} not found`,
      );
    }

    const offer = this.offerRepository.create({
      name: createOfferDto.name,
      price: createOfferDto.price,
      deliveryDate: new Date(createOfferDto.deliveryDate),
      quantity: createOfferDto.quantity,
      product,
      provider,
    });

    return this.offerRepository.save(offer);
  }

  async findAll(productId?: number): Promise<Offer[]> {
    const where = productId ? { productId } : {};
    return this.offerRepository.find({
      where,
      relations: ["product", "provider"],
      order: { createdAt: "DESC" },
    });
  }

  async findOne(id: number): Promise<Offer | null> {
    return this.offerRepository.findOne({
      where: { id },
      relations: ["product", "provider"],
    });
  }

  async findByProduct(productId: number): Promise<Offer[]> {
    return this.offerRepository.find({
      where: { productId },
      relations: ["product", "provider"],
      order: { createdAt: "DESC" },
    });
  }

  async update(
    id: number,
    updateOfferDto: UpdateOfferDto,
  ): Promise<Offer> {
    const offer = await this.findOne(id);
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    if (updateOfferDto.productId) {
      const product = await this.productRepository.findOne({
        where: { id: updateOfferDto.productId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${updateOfferDto.productId} not found`,
        );
      }
      offer.product = product;
    }

    if (updateOfferDto.providerId) {
      const provider = await this.providerRepository.findOne({
        where: { id: updateOfferDto.providerId },
      });
      if (!provider) {
        throw new NotFoundException(
          `Provider with ID ${updateOfferDto.providerId} not found`,
        );
      }
      offer.provider = provider;
    }

    if (updateOfferDto.name !== undefined) {
      offer.name = updateOfferDto.name;
    }
    if (updateOfferDto.price !== undefined) {
      offer.price = updateOfferDto.price;
    }
    if (updateOfferDto.deliveryDate) {
      offer.deliveryDate = new Date(updateOfferDto.deliveryDate);
    }
    if (updateOfferDto.quantity !== undefined) {
      offer.quantity = updateOfferDto.quantity;
    }
    return this.offerRepository.save(offer);
  }

  async remove(id: number): Promise<void> {
    const offer = await this.findOne(id);
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    await this.offerRepository.remove(offer);
  }
}

