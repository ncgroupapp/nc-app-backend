import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { Quotation, QuotationItem, QuotationStatus } from './entities/quotation.entity';
import { AdjudicationsService } from '@/contexts/adjudications/adjudications.service';
import { AdjudicationStatus } from '@/contexts/adjudications/entities/adjudication.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";
import { Product } from '@/contexts/products/entities/product.entity';
import { Licitation, LicitationStatus } from '@/contexts/licitations/entities/licitation.entity';

@Injectable()
export class QuotationService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private readonly quotationItemRepository: Repository<QuotationItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Licitation)
    private readonly licitationRepository: Repository<Licitation>,
    private readonly adjudicationsService: AdjudicationsService,
  ) {}

  async create(createQuotationDto: CreateQuotationDto): Promise<Quotation> {
    // Verificar si ya existe una cotización con ese identificador
    const existingQuotation = await this.quotationRepository.findOne({
      where: { quotationIdentifier: createQuotationDto.quotationIdentifier },
    });

    if (existingQuotation) {
      throw new ConflictException(
        `Ya existe una cotización con el identificador: ${createQuotationDto.quotationIdentifier}`,
      );
    }

    // Crear la cotización con sus items
    const quotation = this.quotationRepository.create({
      quotationIdentifier: createQuotationDto.quotationIdentifier,
      associatedPurchase: createQuotationDto.associatedPurchase,
      status: createQuotationDto.status,
      description: createQuotationDto.description,
      observations: createQuotationDto.observations,
      quotationDate: createQuotationDto.quotationDate
        ? new Date(createQuotationDto.quotationDate)
        : undefined,
      validUntil: createQuotationDto.validUntil
        ? new Date(createQuotationDto.validUntil)
        : undefined,
      clientId: createQuotationDto.clientId,
      licitationId: createQuotationDto.licitationId,
      clientName: createQuotationDto.clientName,

      paymentForm: createQuotationDto.paymentForm,
      validity: createQuotationDto.validity,
      items: await Promise.all(createQuotationDto.items.map(async (item) => {
        // Usar productName del DTO directamente, o buscarlo por productId como fallback
        let productName = item.productName;
        if (!productName && item.productId) {
          const product = await this.productRepository.findOne({ where: { id: item.productId } });
          if (!product) {
            throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
          }
          productName = product.name;
        }
        if (!productName) {
          throw new NotFoundException('Se requiere productName o un productId válido');
        }
        return this.quotationItemRepository.create({
          ...item,
          productName,
        });
      })),
    });

    return await this.quotationRepository.save(quotation);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Quotation>> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.quotationRepository.findAndCount({
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

  async findOne(id: number): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!quotation) {
      throw new NotFoundException(`Cotización con ID ${id} no encontrada`);
    }

    return quotation;
  }

  async findByIdentifier(identifier: string): Promise<Quotation> {
    const quotation = await this.quotationRepository.findOne({
      where: { quotationIdentifier: identifier },
      relations: ['items'],
    });

    if (!quotation) {
      throw new NotFoundException(
        `Cotización con identificador ${identifier} no encontrada`,
      );
    }

    return quotation;
  }

  async update(
    id: number,
    updateQuotationDto: UpdateQuotationDto,
  ): Promise<Quotation> {
    const quotation = await this.findOne(id);

    // Si se está actualizando el identificador, verificar que no exista otro con ese identificador
    if (
      updateQuotationDto.quotationIdentifier &&
      updateQuotationDto.quotationIdentifier !== quotation.quotationIdentifier
    ) {
      const existingQuotation = await this.quotationRepository.findOne({
        where: { quotationIdentifier: updateQuotationDto.quotationIdentifier },
      });

      if (existingQuotation) {
        throw new ConflictException(
          `Ya existe una cotización con el identificador: ${updateQuotationDto.quotationIdentifier}`,
        );
      }
    }

    // Si se están actualizando los items, eliminar los antiguos y crear los nuevos
    if (updateQuotationDto.items) {
      // Eliminar items antiguos
      if (quotation.items && quotation.items.length > 0) {
        await this.quotationItemRepository.remove(quotation.items);
      }

      // Crear nuevos items
      quotation.items = await Promise.all(updateQuotationDto.items.map(async (item) => {
        // Usar productName, brand, origin del DTO si existen, o buscarlos por productId
        let productName = item.productName;
        let brand = item.brand;
        let origin = item.origin;

        if ((!productName || !brand || !origin) && item.productId) {
          const product = await this.productRepository.findOne({ where: { id: item.productId } });
          if (product) {
            if (!productName) productName = product.name;
            if (!brand) brand = product.brand;
            if (!origin) origin = product.origin;
          } else if (!productName) {
            throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
          }
        }

        if (!productName) {
          throw new NotFoundException('Se requiere productName o un productId válido');
        }

        return this.quotationItemRepository.create({ 
          ...item, 
          quotationId: id,
          productName,
          brand,
          origin,
        });
      }));
    }

    // Actualizar campos de la cotización (excluyendo items ya que fueron procesados arriba)
    const { items: _items, ...quotationFieldsToUpdate } = updateQuotationDto;
    Object.assign(quotation, {
      ...quotationFieldsToUpdate,
      quotationDate: updateQuotationDto.quotationDate
        ? new Date(updateQuotationDto.quotationDate)
        : quotation.quotationDate,
      validUntil: updateQuotationDto.validUntil
        ? new Date(updateQuotationDto.validUntil)
        : quotation.validUntil,
    });

    const savedQuotation = await this.quotationRepository.save(quotation);

    // Si la cotización se finaliza, actualizar el estado de la licitación a QUOTED
    if (savedQuotation.status === QuotationStatus.FINALIZED && savedQuotation.licitationId) {
      const licitation = await this.licitationRepository.findOne({ where: { id: savedQuotation.licitationId } });
      if (licitation && licitation.status === LicitationStatus.PENDING) {
        licitation.status = LicitationStatus.QUOTED;
        await this.licitationRepository.save(licitation);
      }
    }

    // Check if status changed to FINALIZED and trigger adjudication if needed
    // Note: This logic assumes that "Finalized" means we are ready to adjudicate.
    // However, usually adjudication happens AFTER the quotation is sent and accepted.
    // The requirements say: "Manejo del resultado de la adjudicación... Administrador accede a la cotización... Cambia estado de productos... Se crea una adjudicación"
    // So maybe we need a specific method to "Adjudicate" or check if items are awarded.
    
    // Let's add a check: if the quotation is finalized AND has awarded items, create adjudication.
    // Or maybe we should expose a separate method `createAdjudicationFromQuotation`.
    // For now, let's hook it here if the status becomes FINALIZED.
    
    if (savedQuotation.status === QuotationStatus.FINALIZED) {
        // Filter awarded items
        const awardedItems = savedQuotation.items.filter(item => item.awardStatus === 'adjudicado'); // Using string literal as enum might be tricky to import if circular, but we have it.
        
        if (awardedItems.length > 0) {
            // Determine if total or partial
            const isTotal = awardedItems.length === savedQuotation.items.length;
            
            // TODO: To implement automatic adjudication, we need:
            // 1. The Licitation ID (currently not directly linked in Quotation entity)
            // 2. Mapping of Quotation Items to Adjudication Items (including unit prices)
            // 3. A decision on whether this should be automatic or manual.
            // For now, we rely on the manual creation via AdjudicationsController.
            
            /*
            await this.adjudicationsService.create({
                quotationId: savedQuotation.id,
                licitationId: 1, 
                status: isTotal ? AdjudicationStatus.TOTAL : AdjudicationStatus.PARTIAL,
                items: awardedItems.map(item => ({
                    sku: item.sku,
                    quantity: item.quantity,
                    unitPrice: Number(item.priceWithoutIVA), // Assuming base price
                    productId: item.productId
                }))
            });
            */
        }
    }

    return savedQuotation;
  }

  async remove(id: number): Promise<void> {
    const quotation = await this.findOne(id);
    await this.quotationRepository.remove(quotation);
  }

  // Métodos adicionales útiles

  async findByStatus(status: string): Promise<Quotation[]> {
    return await this.quotationRepository.find({
      where: { status: status as any },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByClient(clientId: number): Promise<Quotation[]> {
    return await this.quotationRepository.find({
      where: { clientId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTotalsByQuotation(id: number): Promise<{
    totalWithoutIVA: number;
    totalWithIVA: number;
    totalItems: number;
    itemsByCurrency: Record<string, { withoutIVA: number; withIVA: number }>;
  }> {
    const quotation = await this.findOne(id);

    const itemsByCurrency: Record<
      string,
      { withoutIVA: number; withIVA: number }
    > = {};

    quotation.items.forEach((item) => {
      const currency = item.currency;
      if (!itemsByCurrency[currency]) {
        itemsByCurrency[currency] = { withoutIVA: 0, withIVA: 0 };
      }
      itemsByCurrency[currency].withoutIVA +=
        Number(item.priceWithoutIVA) * item.quantity;
      itemsByCurrency[currency].withIVA +=
        Number(item.priceWithIVA) * item.quantity;
    });

    return {
      totalWithoutIVA: quotation.items.reduce(
        (sum, item) => sum + Number(item.priceWithoutIVA) * item.quantity,
        0,
      ),
      totalWithIVA: quotation.items.reduce(
        (sum, item) => sum + Number(item.priceWithIVA) * item.quantity,
        0,
      ),
      totalItems: quotation.items.length,
      itemsByCurrency,
    };
  }
}
