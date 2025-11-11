import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { Quotation, QuotationItem } from './entities/quotation.entity';

@Injectable()
export class QuotationService {
  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepository: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private readonly quotationItemRepository: Repository<QuotationItem>,
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
      clientName: createQuotationDto.clientName,
      paymentForm: createQuotationDto.paymentForm,
      validity: createQuotationDto.validity,
      items: createQuotationDto.items.map((item) =>
        this.quotationItemRepository.create(item),
      ),
    });

    return await this.quotationRepository.save(quotation);
  }

  async findAll(): Promise<Quotation[]> {
    return await this.quotationRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
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
      quotation.items = updateQuotationDto.items.map((item) =>
        this.quotationItemRepository.create({ ...item, quotationId: id }),
      );
    }

    // Actualizar campos de la cotización
    Object.assign(quotation, {
      ...updateQuotationDto,
      quotationDate: updateQuotationDto.quotationDate
        ? new Date(updateQuotationDto.quotationDate)
        : quotation.quotationDate,
      validUntil: updateQuotationDto.validUntil
        ? new Date(updateQuotationDto.validUntil)
        : quotation.validUntil,
    });

    return await this.quotationRepository.save(quotation);
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
