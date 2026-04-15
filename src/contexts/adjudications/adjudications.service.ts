import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adjudication, AdjudicationStatus, AdjudicationItem } from './entities/adjudication.entity';
import { CreateAdjudicationDto } from './dto/create-adjudication.dto';
import { AddAdjudicationItemDto } from './dto/add-adjudication-item.dto';
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
          // Buscar si ya existe este item en la adjudicación para no duplicar la cantidad adjudicada
          const existingItemInAdjudication = existingAdjudication?.items?.find(
            i => i.productId === itemDto.productId
          );

          const previousQuantityInAdjudication = existingItemInAdjudication ? existingItemInAdjudication.quantity : 0;
          const currentAwardedTotal = quotationItem.awardedQuantity || 0;
          
          // La nueva cantidad total adjudicada es: (total anterior) - (lo que ya estaba en esta adjudicación) + (lo nuevo)
          const newAwarded = currentAwardedTotal - previousQuantityInAdjudication + itemDto.quantity;
          
          quotationItem.awardedQuantity = newAwarded;

          if (newAwarded >= quotationItem.quantity) {
            quotationItem.awardStatus = QuotationAwardStatus.AWARDED;
          } else if (newAwarded > 0) {
            quotationItem.awardStatus = QuotationAwardStatus.PARTIALLY_AWARDED;
          } else {
            quotationItem.awardStatus = QuotationAwardStatus.PENDING;
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
            quantity: itemDto.quantity || 0,
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
      // Solo eliminamos items si explícitamente se indica que NO fueron adjudicados
      // ya que el frontend envía deltas (un item a la vez)
      const rejectedProductIds = (createAdjudicationDto.nonAwardedItems || [])
        .map(item => item.productId)
        .filter(id => id !== undefined);

      if (existingAdjudication.items && rejectedProductIds.length > 0) {
        for (const item of [...existingAdjudication.items]) {
          if (item.productId && rejectedProductIds.includes(item.productId)) {
            await this.adjudicationItemRepository.remove(item);
            existingAdjudication.items = existingAdjudication.items.filter(i => i.id !== item.id);
          }
        }
      }

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
          const savedNewItem = await this.adjudicationItemRepository.save(itemToSave);
          if (existingAdjudication.items) {
            existingAdjudication.items.push(savedNewItem);
          } else {
            existingAdjudication.items = [savedNewItem];
          }
        }
      }

      existingAdjudication.status = createAdjudicationDto.status;
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

  async findAll(paginationDto: PaginationDto, search?: string, status?: string, quotationId?: number, licitationId?: number, productId?: number, closedOnly?: boolean): Promise<PaginatedResult<Adjudication>> {
    const { page = 1, limit = 10 } = paginationDto;

    const queryBuilder = this.adjudicationRepository.createQueryBuilder('adjudication')
      .leftJoinAndSelect('adjudication.items', 'items')
      .leftJoinAndSelect('adjudication.licitation', 'licitation')
      .leftJoinAndSelect('licitation.client', 'client')
      .orderBy('adjudication.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filter based on closedOnly parameter
    if (closedOnly === true) {
      // Only adjudications from closed licitations
      queryBuilder.andWhere('licitation.status = :closedStatus', { closedStatus: LicitationStatus.CLOSED });
    } else {
      // By default, exclude adjudications from closed licitations
      queryBuilder.andWhere('licitation.status != :closedStatus', { closedStatus: LicitationStatus.CLOSED });
    }

    if (search) {
      // Cast the numeric ID to text to search along with potential string references
      queryBuilder.andWhere(
        '(adjudication.id::text ILIKE :search OR licitation.callNumber ILIKE :search OR licitation.internalNumber ILIKE :search OR client.name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (status) {
      queryBuilder.andWhere('adjudication.status = :status', { status });
    }

    if (quotationId) {
      queryBuilder.andWhere('adjudication.quotationId = :quotationId', { quotationId });
    }

    if (licitationId) {
      queryBuilder.andWhere('adjudication.licitationId = :licitationId', { licitationId });
    }

    if (productId) {
      queryBuilder.andWhere('items.productId = :productId', { productId });
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

  async findOne(id: number): Promise<Adjudication> {
    const adjudication = await this.adjudicationRepository.findOne({
      where: { id },
      relations: ['items', 'licitation'],
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

  /**
   * Agrega un item a una adjudicación existente
   * @param adjudicationId - ID de la adjudicación
   * @param itemDto - Datos del item a agregar
   * @returns La adjudicación actualizada con el nuevo item
   */
  async addItem(adjudicationId: number, itemDto: AddAdjudicationItemDto): Promise<Adjudication> {
    // Find the adjudication
    const adjudication = await this.findOne(adjudicationId);

    // Create the new item with explicit properties
    const newItem = this.adjudicationItemRepository.create({
      productId: itemDto.productId,
      quantity: itemDto.quantity,
      unitPrice: itemDto.unitPrice,
      productName: '', // Will be populated if needed
      adjudicationId,
    });

    // Save the new item - TypeORM returns the entity with proper type
    const savedItem = await this.adjudicationItemRepository.save(newItem);

    // Recalculate totals
    const existingItems = adjudication.items || [];
    const allItems: AdjudicationItem[] = [...existingItems, savedItem];

    let totalPriceWithoutIVA = 0;
    let totalQuantity = 0;

    allItems.forEach((item: AdjudicationItem) => {
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
   * Elimina un producto específico de la adjudicación y sincroniza entregas.
   */
  async removeProductFromAdjudication(quotationId: number, productId: number): Promise<void> {
    const adjudication = await this.adjudicationRepository.findOne({
      where: { quotationId },
      relations: ['items'],
    });

    if (!adjudication || !adjudication.items) return;

    const itemToRemove = adjudication.items.find(item => item.productId === productId);
    if (itemToRemove) {
      await this.adjudicationItemRepository.remove(itemToRemove);
      
      adjudication.items = adjudication.items.filter(item => item.id !== itemToRemove.id);
      
      const allItems = adjudication.items || [];
      adjudication.totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);
      adjudication.totalPriceWithoutIVA = allItems.reduce((sum, item) => sum + (item.quantity * Number(item.unitPrice)), 0);
      adjudication.totalPriceWithIVA = adjudication.totalPriceWithoutIVA * 1.19;
      
      const savedAdjudication = await this.adjudicationRepository.save(adjudication);
      
      await this.updateLicitationStatus(savedAdjudication.licitationId);
      await this.deliveriesService.addItemsFromAdjudication(savedAdjudication);
    }
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

    const quotation = quotationItem.quotation;

    if (newQuantity <= 0 && quotationItem.productId) {
      // Si la cantidad es 0, removemos de la adjudicación y entregas
      if (quotationItem.quotationId) {
        await this.removeProductFromAdjudication(quotationItem.quotationId, quotationItem.productId);
      }
    } else if (quotation.licitationId) {
      // Usar el método create para sincronizar todo (Cotización, Adjudicación, Stock, Entrega)
      await this.create({
        licitationId: quotation.licitationId,
        quotationId: quotation.id,
        status: newQuantity >= quotationItem.quantity ? AdjudicationStatus.TOTAL : AdjudicationStatus.PARTIAL,
        items: [{
          productId: quotationItem.productId!,
          quantity: newQuantity,
          unitPrice: quotationItem.priceWithoutIVA,
          productName: quotationItem.productName || '',
        }],
      });
    }

    // Retornar el item actualizado
    const updatedItem = await this.quotationItemRepository.findOne({
      where: { id: quotationItemId }
    });
    
    return updatedItem || quotationItem;
  }
}
