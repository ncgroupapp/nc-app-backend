import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { DeliveryItem, DeliveryItemStatus } from './entities/delivery-item.entity';
import { Invoice } from './entities/invoice.entity';
import { Adjudication, AdjudicationItem } from '@/contexts/adjudications/entities/adjudication.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";

export interface CreateDeliveryItemDto {
  productId?: number;
  productCode: string;
  productName: string;
  quantity: number;
  estimatedDate: Date;
}

export interface UpdateDeliveryItemDto {
  status?: DeliveryItemStatus;
  actualDate?: Date;
  observations?: string;
  quantity?: number;
}

export interface CreateInvoiceDto {
  invoiceNumber: string;
  fileName?: string;
  fileUrl?: string;
  issueDate: Date;
}

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
    @InjectRepository(DeliveryItem)
    private readonly deliveryItemRepository: Repository<DeliveryItem>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  /**
   * Busca una entrega existente para la licitación o crea una nueva
   */
  async findOrCreateByLicitation(licitationId: number): Promise<Delivery> {
    let delivery = await this.deliveryRepository.findOne({
      where: { licitationId },
      relations: ['items', 'invoices'],
    });

    if (!delivery) {
      delivery = this.deliveryRepository.create({
        licitationId,
        items: [],
        invoices: [],
      });
      delivery = await this.deliveryRepository.save(delivery);
    }

    return delivery;
  }

  /**
   * Agrega items a una entrega desde una adjudicación
   * Si ya existe un item para el mismo producto, actualiza la cantidad en lugar de crear duplicados
   */
  async addItemsFromAdjudication(adjudication: Adjudication): Promise<Delivery> {
    const delivery = await this.findOrCreateByLicitation(adjudication.licitationId);

    // Calcular fecha estimada (máximo plazo de los items, o 7 días por defecto)
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 7);

    // Crear o actualizar DeliveryItems para cada AdjudicationItem
    if (adjudication.items && adjudication.items.length > 0) {
      for (const adjItem of adjudication.items) {
        // Buscar si ya existe un DeliveryItem para este producto
        const existingItem = await this.deliveryItemRepository.findOne({
          where: { 
            deliveryId: delivery.id, 
            productId: adjItem.productId 
          }
        });

        if (existingItem) {
          // Si existe, actualizar la cantidad (reemplazar, no sumar)
          existingItem.quantity = adjItem.quantity;
          await this.deliveryItemRepository.save(existingItem);
        } else {
          // Si no existe, crear nuevo
          const deliveryItem = this.deliveryItemRepository.create({
            deliveryId: delivery.id,
            productId: adjItem.productId,
            productCode: adjItem.productName || `PROD-${adjItem.productId}`,
            productName: adjItem.productName || 'Producto',
            quantity: adjItem.quantity,
            status: DeliveryItemStatus.PENDING,
            estimatedDate,
          });
          await this.deliveryItemRepository.save(deliveryItem);
        }
      }
    }

    // Retornar delivery actualizada con items
    return await this.findOne(delivery.id);
  }

  /**
   * Método legacy para compatibilidad - ahora usa addItemsFromAdjudication
   */
  async createFromAdjudication(adjudication: Adjudication): Promise<Delivery> {
    return this.addItemsFromAdjudication(adjudication);
  }

  /**
   * Agrega un item individual a una entrega
   */
  async addItem(deliveryId: number, itemDto: CreateDeliveryItemDto): Promise<DeliveryItem> {
    const delivery = await this.findOne(deliveryId);

    const item = this.deliveryItemRepository.create({
      ...itemDto,
      deliveryId: delivery.id,
      status: DeliveryItemStatus.PENDING,
    });

    return await this.deliveryItemRepository.save(item);
  }

  /**
   * Actualiza el estado de un item de entrega
   */
  async updateItemStatus(
    deliveryId: number,
    itemId: number,
    updateDto: UpdateDeliveryItemDto
  ): Promise<DeliveryItem> {
    const item = await this.deliveryItemRepository.findOne({
      where: { id: itemId, deliveryId },
    });

    if (!item) {
      throw new NotFoundException(
        `Item ${itemId} no encontrado en la entrega ${deliveryId}`
      );
    }

    Object.assign(item, updateDto);

    // Si se marca como entregado, registrar fecha real si no se proporcionó
    if (updateDto.status === DeliveryItemStatus.DELIVERED && !item.actualDate) {
      item.actualDate = new Date();
    }

    return await this.deliveryItemRepository.save(item);
  }

  /**
   * Agrega una factura a la entrega
   */
  async addInvoice(deliveryId: number, invoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const delivery = await this.findOne(deliveryId);

    const invoice = this.invoiceRepository.create({
      ...invoiceDto,
      deliveryId: delivery.id,
    });

    return await this.invoiceRepository.save(invoice);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Delivery>> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.deliveryRepository.findAndCount({
      relations: ['items', 'invoices'],
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

  async findOne(id: number): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: { id },
      relations: ['items', 'invoices'],
    });

    if (!delivery) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada`);
    }

    return delivery;
  }

  async findByLicitation(licitationId: number): Promise<Delivery | null> {
    return await this.deliveryRepository.findOne({
      where: { licitationId },
      relations: ['items', 'invoices'],
    });
  }

  async getDeliveryItems(deliveryId: number): Promise<DeliveryItem[]> {
    return await this.deliveryItemRepository.find({
      where: { deliveryId },
      order: { createdAt: 'ASC' },
    });
  }

  async getInvoices(deliveryId: number): Promise<Invoice[]> {
    return await this.invoiceRepository.find({
      where: { deliveryId },
      order: { createdAt: 'DESC' },
    });
  }
}
