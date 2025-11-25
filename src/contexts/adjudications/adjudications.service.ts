import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Adjudication, AdjudicationStatus, AdjudicationItem } from './entities/adjudication.entity';
import { CreateAdjudicationDto } from './dto/create-adjudication.dto';
import { DeliveriesService } from '@/contexts/deliveries/deliveries.service';
import { Quotation } from '@/contexts/quotation/entities/quotation.entity';
import { Licitation } from '@/contexts/licitations/entities/licitation.entity';

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
    private readonly deliveriesService: DeliveriesService,
  ) {}

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

    // Calculate totals
    let totalPriceWithoutIVA = 0;
    let totalPriceWithIVA = 0; 
    let totalQuantity = 0;

    const items = createAdjudicationDto.items.map(itemDto => {
      totalQuantity += itemDto.quantity;
      totalPriceWithoutIVA += itemDto.unitPrice * itemDto.quantity;
      return this.adjudicationItemRepository.create(itemDto);
    });
    
    totalPriceWithIVA = totalPriceWithoutIVA * 1.19; // Default IVA 19%

    const adjudication = this.adjudicationRepository.create({
      ...createAdjudicationDto,
      totalPriceWithoutIVA,
      totalPriceWithIVA,
      totalQuantity,
      items,
    });

    const savedAdjudication = await this.adjudicationRepository.save(adjudication);

    // Trigger Delivery Creation
    await this.deliveriesService.createFromAdjudication(savedAdjudication);

    return savedAdjudication;
  }

  async findAll(): Promise<Adjudication[]> {
    return await this.adjudicationRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
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
    const savedItem = await this.adjudicationItemRepository.save(newItem);

    // Recalculate totals
    const existingItems = adjudication.items || [];
    const allItems = [...existingItems, savedItem];
    
    let totalPriceWithoutIVA = 0;
    let totalQuantity = 0;

    allItems.forEach(item => {
      totalQuantity += item.quantity;
      totalPriceWithoutIVA += Number(item.unitPrice) * item.quantity;
    });

    const totalPriceWithIVA = totalPriceWithoutIVA * 1.19;

    // Update adjudication totals
    adjudication.totalPriceWithoutIVA = totalPriceWithoutIVA;
    adjudication.totalPriceWithIVA = totalPriceWithIVA;
    adjudication.totalQuantity = totalQuantity;

    await this.adjudicationRepository.save(adjudication);

    // Return updated adjudication with all items
    return await this.findOne(adjudicationId);
  }

  async remove(id: number): Promise<void> {
    const adjudication = await this.findOne(id);
    await this.adjudicationRepository.remove(adjudication);
  }
}
