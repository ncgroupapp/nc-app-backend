import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adjudication, AdjudicationStatus, AdjudicationItem } from './entities/adjudication.entity';
import { CreateAdjudicationDto } from './dto/create-adjudication.dto';
import { DeliveriesService } from '@/contexts/deliveries/deliveries.service';
import { Quotation, QuotationItem, QuotationAwardStatus } from '@/contexts/quotation/entities/quotation.entity';
import { Licitation, LicitationStatus } from '@/contexts/licitations/entities/licitation.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { Product } from '@/contexts/products/entities/product.entity';

@Injectable()
export class AdjudicationsService {
  constructor(
    @InjectRepository(Adjudication)
    private readonly adjudicationRepository: Repository<Adjudication>,
    @InjectRepository(AdjudicationItem)
    private readonly adjudicationItemRepository: Repository<AdjudicationItem>,
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(Licitation)
    private readonly licitationRepository: Repository<Licitation>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(QuotationItem)
    private readonly quotationItemRepository: Repository<QuotationItem>,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  async findByClient(clientId: number): Promise<Adjudication[]> {
    return this.adjudicationRepository.find({
      relations: ['quotation', 'items', 'items.product'],
      where: {
        quotation: {
          clientId: clientId,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProduct(productId: number): Promise<Adjudication[]> {
    return this.adjudicationRepository.find({
      relations: ['quotation', 'items', 'items.product'],
      where: {
        items: {
          productId: productId,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProvider(providerId: number): Promise<Adjudication[]> {
    return this.adjudicationRepository.find({
      relations: ['quotation', 'quotation.items', 'items', 'items.product'],
      where: {
        quotation: {
          items: {
            providerId: providerId,
          },
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async create(createAdjudicationDto: CreateAdjudicationDto): Promise<Adjudication> {
    // Validate that quotation exists
    const quotation = await this.quotationRepository.findOne({
      where: { id: createAdjudicationDto.quotationId },
    });

    if (!quotation) {
      throw new NotFoundException(
        `Cotización con ID ${createAdjudicationDto.quotationId} no encontrada`,
      );
    }

    // Validate that licitation exists
    const licitation = await this.licitationRepository.findOne({
      where: { id: createAdjudicationDto.licitationId },
    });

    if (!licitation) {
      throw new NotFoundException(
        `Licitación con ID ${createAdjudicationDto.licitationId} no encontrada`,
      );
    }

    // Check if an adjudication already exists for this licitation and quotation
    let existingAdjudication = await this.adjudicationRepository.findOne({
      where: {
        licitationId: createAdjudicationDto.licitationId,
        quotationId: createAdjudicationDto.quotationId,
      },
      relations: ['items'],
    });

    // Calculate totals for new items
    let newTotalPriceWithoutIVA = 0;
    let newTotalQuantity = 0;

    const newItems = await Promise.all(createAdjudicationDto.items.map(async (itemDto) => {
      newTotalQuantity += itemDto.quantity;
      newTotalPriceWithoutIVA += itemDto.unitPrice * itemDto.quantity;

      // Update Quotation Item Status
      if (itemDto.productId) {
        const quotationItem = await this.quotationItemRepository.findOne({
          where: { 
            quotationId: createAdjudicationDto.quotationId,
            productId: itemDto.productId 
          }
        });

        if (quotationItem) {
          const currentAwarded = quotationItem.awardedQuantity || 0;
          const newAwarded = currentAwarded + itemDto.quantity;
          
          quotationItem.awardedQuantity = newAwarded;

          if (newAwarded >= quotationItem.quantity) {
            quotationItem.awardStatus = QuotationAwardStatus.AWARDED;
          } else {
            quotationItem.awardStatus = QuotationAwardStatus.PARTIALLY_AWARDED;
          }
          await this.quotationItemRepository.save(quotationItem);
        }
      }

      // Update Product Stock
      const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
      if (product) {
        product.stockQuantity = (product.stockQuantity || 0) - itemDto.quantity;
        await this.productRepository.save(product);
      }

      return itemDto; // Return DTO directly, will create entity when saving
    }));

    // Process Non-Awarded Items
    if (createAdjudicationDto.nonAwardedItems) {
      await Promise.all(createAdjudicationDto.nonAwardedItems.map(async (itemDto) => {
        // Update Quotation Item Status to NOT_AWARDED
        const quotationItem = await this.quotationItemRepository.findOne({
          where: { 
            quotationId: createAdjudicationDto.quotationId,

            productId: itemDto.productId 
          }
        });

        if (quotationItem) {
          quotationItem.awardStatus = QuotationAwardStatus.NOT_AWARDED;
          await this.quotationItemRepository.save(quotationItem);
        }

        // Update Product History (Winner Info)
        const product = await this.productRepository.findOne({ where: { id: itemDto.productId } });
        if (product) {
          const historyEntry = {
            date: new Date(),
            licitationId: createAdjudicationDto.licitationId,
            competitorName: itemDto.competitorName,
            competitorRut: itemDto.competitorRut,
            competitorPrice: itemDto.competitorPrice,
            competitorBrand: itemDto.competitorBrand,
          };
          
          const currentHistory = product.adjudicationHistory || [];
          product.adjudicationHistory = [...currentHistory, historyEntry];
          await this.productRepository.save(product);
        }
      }));
    }

    let savedAdjudication: Adjudication;

    if (existingAdjudication) {
      // Check for existing items and update or create
      for (const newItem of newItems) {
        // Check if item with same productId already exists
        const existingItem = existingAdjudication.items?.find(
          item => item.productId === newItem.productId
        );

        if (existingItem) {
          // Update existing item - replace quantity and price (not accumulate)
          existingItem.quantity = newItem.quantity;
          existingItem.unitPrice = newItem.unitPrice;
          if (newItem.productName) existingItem.productName = newItem.productName;
          await this.adjudicationItemRepository.save(existingItem);
        } else {
          // Create new item only if productId doesn't exist
          const itemToSave = this.adjudicationItemRepository.create({
            ...newItem,
            adjudicationId: existingAdjudication.id,
          });
          await this.adjudicationItemRepository.save(itemToSave);
        }
      }

      savedAdjudication = await this.adjudicationRepository.save(existingAdjudication);
      
      // Reload adjudication with updated items for delivery processing
      savedAdjudication = await this.adjudicationRepository.findOne({
        where: { id: savedAdjudication.id },
        relations: ['items'],
      }) || savedAdjudication;

      // Recalculate totals from actual items
      const allItems = savedAdjudication.items || [];
      savedAdjudication.totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);
      savedAdjudication.totalPriceWithoutIVA = allItems.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice)), 0);
      savedAdjudication.totalPriceWithIVA = savedAdjudication.totalPriceWithoutIVA * 1.19;
      
      savedAdjudication = await this.adjudicationRepository.save(savedAdjudication);

      // Add new items to delivery
      await this.deliveriesService.addItemsFromAdjudication(savedAdjudication);
    } else {
      // Create new adjudication (WITHOUT items first to get ID)
      const newTotalPriceWithIVA = newTotalPriceWithoutIVA * 1.19;

      const adjudication = this.adjudicationRepository.create({
        ...createAdjudicationDto,
        totalPriceWithoutIVA: newTotalPriceWithoutIVA,
        totalPriceWithIVA: newTotalPriceWithIVA,
        totalQuantity: newTotalQuantity,
        items: [], // Save without items first
      });

      savedAdjudication = await this.adjudicationRepository.save(adjudication);

      // Now save items with the correct adjudicationId
      for (const newItem of newItems) {
        const itemToSave = this.adjudicationItemRepository.create({
          ...newItem,
          adjudicationId: savedAdjudication.id,
        });
        await this.adjudicationItemRepository.save(itemToSave);
      }

      // Reload with items
      savedAdjudication = await this.adjudicationRepository.findOne({
        where: { id: savedAdjudication.id },
        relations: ['items'],
      }) || savedAdjudication;

      // Trigger Delivery Creation for new adjudications
      await this.deliveriesService.createFromAdjudication(savedAdjudication);
    }

    // Update Licitation Status
    await this.updateLicitationStatus(savedAdjudication.licitationId);

    return savedAdjudication;
  }

  /**
   * Recalcula y actualiza el estado de la licitación basado en sus adjudicaciones
   */
  private async updateLicitationStatus(licitationId: number): Promise<void> {
    const licitation = await this.licitationRepository.findOne({
      where: { id: licitationId },
      relations: ['licitationProducts'],
    });

    if (!licitation) return;

    // Obtener todas las adjudicaciones de esta licitación
    const adjudications = await this.adjudicationRepository.find({
      where: { licitationId },
      relations: ['items'],
    });

    if (adjudications.length === 0) {
      licitation.status = LicitationStatus.PENDING;
      await this.licitationRepository.save(licitation);
      return;
    }

    // Calcular cantidades totales adjudicadas por producto
    const awardedQuantities = new Map<number, number>();
    adjudications.forEach(adj => {
      adj.items?.forEach(item => {
        if (item.productId) {
          const current = awardedQuantities.get(item.productId) || 0;
          awardedQuantities.set(item.productId, current + item.quantity);
        }
      });
    });

    // Comparar con las cantidades solicitadas en la licitación
    let allCompleted = true;
    let someAwarded = false;

    if (!licitation.licitationProducts || licitation.licitationProducts.length === 0) {
      // Si no hay productos definidos, nos basamos solo en si hay adjudicaciones
      licitation.status = adjudications.length > 0 ? LicitationStatus.PARTIAL_ADJUDICATION : LicitationStatus.PENDING;
    } else {
      for (const lp of licitation.licitationProducts) {
        const awarded = awardedQuantities.get(lp.productId) || 0;
        if (awarded > 0) someAwarded = true;
        if (awarded < lp.quantity) allCompleted = false;
      }

      if (allCompleted) {
        licitation.status = LicitationStatus.TOTAL_ADJUDICATION;
      } else if (someAwarded) {
        licitation.status = LicitationStatus.PARTIAL_ADJUDICATION;
      } else {
        licitation.status = LicitationStatus.PENDING;
      }
    }

    await this.licitationRepository.save(licitation);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Adjudication>> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.adjudicationRepository.findAndCount({
      relations: ['items'],
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

  async findOne(id: number): Promise<Adjudication> {
    const adjudication = await this.adjudicationRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!adjudication) {
      throw new NotFoundException(`Adjudicación con ID ${id} no encontrada`);
    }

    return adjudication;
  }

  async findByStatus(status: AdjudicationStatus): Promise<Adjudication[]> {
    return await this.adjudicationRepository.find({
      where: { status },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByQuotation(quotationId: number): Promise<Adjudication[]> {
    return await this.adjudicationRepository.find({
      where: { quotationId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByLicitation(licitationId: number): Promise<Adjudication[]> {
    return await this.adjudicationRepository.find({
      where: { licitationId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async addItem(adjudicationId: number, itemDto: any): Promise<Adjudication> {
    // Find the adjudication
    const adjudication = await this.findOne(adjudicationId);

    // Create the new item
    const newItem = this.adjudicationItemRepository.create({
      ...itemDto,
      adjudicationId,
    });

    // Save the new item
    const savedItem = (await this.adjudicationItemRepository.save(newItem)) as unknown as AdjudicationItem;

    // Recalculate totals
    const existingItems = adjudication.items || [];
    const allItems: AdjudicationItem[] = [...existingItems, savedItem];
    
    let totalPriceWithoutIVA = 0;
    let totalQuantity = 0;

    allItems.forEach((item: any) => {
      totalQuantity += item.quantity;
      totalPriceWithoutIVA += Number(item.unitPrice) * item.quantity;
    });

    const totalPriceWithIVA = totalPriceWithoutIVA * 1.19;

    // Update adjudication totals
    adjudication.totalPriceWithoutIVA = totalPriceWithoutIVA;
    adjudication.totalPriceWithIVA = totalPriceWithIVA;
    adjudication.totalQuantity = totalQuantity;

    const savedAdjudication = await this.adjudicationRepository.save(adjudication);
    
    // Update Licitation Status
    await this.updateLicitationStatus(savedAdjudication.licitationId);

    return savedAdjudication;
  }

  async remove(id: number): Promise<void> {
    const adjudication = await this.findOne(id);
    const licitationId = adjudication.licitationId;
    await this.adjudicationRepository.remove(adjudication);
    
    // Update Licitation Status after removal
    await this.updateLicitationStatus(licitationId);
  }

  /**
   * Actualiza la cantidad adjudicada de un item de cotización
   * También actualiza la cantidad en el DeliveryItem correspondiente
   */
  async updateAwardedQuantity(
    quotationItemId: number, 
    newQuantity: number
  ): Promise<QuotationItem> {
    const quotationItem = await this.quotationItemRepository.findOne({
      where: { id: quotationItemId },
      relations: ['quotation'],
    });

    if (!quotationItem) {
      throw new NotFoundException(
        `Item de cotización con ID ${quotationItemId} no encontrado`,
      );
    }

    // Actualizar la cantidad adjudicada
    quotationItem.awardedQuantity = newQuantity;

    // Actualizar el estado según la cantidad
    if (newQuantity >= quotationItem.quantity) {
      quotationItem.awardStatus = QuotationAwardStatus.AWARDED;
    } else if (newQuantity > 0) {
      quotationItem.awardStatus = QuotationAwardStatus.PARTIALLY_AWARDED;
    } else {
      quotationItem.awardStatus = QuotationAwardStatus.PENDING;
    }

    await this.quotationItemRepository.save(quotationItem);

    // Buscar y actualizar el DeliveryItem correspondiente
    const quotation = quotationItem.quotation;
    if (quotation) {
      // Buscar la entrega de esta licitación
      if (!quotation.licitationId) return quotationItem;
      const delivery = await this.deliveriesService.findByLicitation(quotation.licitationId);
      if (delivery) {
        // Buscar el item de entrega para este producto
        const deliveryItem = delivery.items?.find(
          (item) => item.productId === quotationItem.productId
        );
        if (deliveryItem) {
          await this.deliveriesService.updateItemStatus(
            delivery.id, 
            deliveryItem.id, 
            { quantity: newQuantity }
          );
        }
      }
    }

    // Actualizar estado de la licitación si es necesario
    if (quotation && quotation.licitationId) {
      await this.updateLicitationStatus(quotation.licitationId);
    }

    return quotationItem;
  }
}
