import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { Adjudication } from '@/contexts/adjudications/entities/adjudication.entity';

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

  async findAll(): Promise<Delivery[]> {
    return await this.deliveryRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}
