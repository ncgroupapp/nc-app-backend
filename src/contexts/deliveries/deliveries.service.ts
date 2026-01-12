import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { Adjudication } from '@/contexts/adjudications/entities/adjudication.entity';
import { PaginationDto } from "../shared/dto/pagination.dto";
import { PaginatedResult } from "../shared/interfaces/paginated-result.interface";

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveryRepository: Repository<Delivery>,
  ) {}

  async createFromAdjudication(adjudication: Adjudication): Promise<Delivery> {
    // Calculate estimated date (e.g., 7 days from now)
    // In a real scenario, this might come from the quotation items' max delivery time.
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + 7);

    const delivery = this.deliveryRepository.create({
      licitationId: adjudication.licitationId,
      adjudicationId: adjudication.id,
      status: DeliveryStatus.PENDING,
      estimatedDate,
    });

    return await this.deliveryRepository.save(delivery);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Delivery>> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.deliveryRepository.findAndCount({
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
}
