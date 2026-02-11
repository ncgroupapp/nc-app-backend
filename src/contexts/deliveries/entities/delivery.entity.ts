import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Licitation } from '@/contexts/licitations/entities/licitation.entity';
import { DeliveryItem, DeliveryItemStatus } from './delivery-item.entity';
import { Invoice } from './invoice.entity';

export enum DeliveryStatus {
  PENDING = 'pendiente',
  PARTIAL = 'parcial',
  COMPLETED = 'completado',
  ISSUE = 'con_problemas',
}

@Entity('deliveries')
export class Delivery {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  licitationId!: number;

  @ManyToOne(() => Licitation)
  @JoinColumn({ name: 'licitationId' })
  licitation!: Licitation;

  @OneToMany('DeliveryItem', 'delivery', { cascade: true, eager: true })
  items!: DeliveryItem[];

  @OneToMany('Invoice', 'delivery', { cascade: true })
  invoices!: Invoice[];

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /**
   * Calcula el estado de la entrega basado en los estados de sus items
   */
  get calculatedStatus(): DeliveryStatus {
    if (!this.items || this.items.length === 0) {
      return DeliveryStatus.PENDING;
    }

    const allDelivered = this.items.every(
      (item) => item.status === DeliveryItemStatus.DELIVERED
    );
    
    if (allDelivered) {
      return DeliveryStatus.COMPLETED;
    }

    const hasIssues = this.items.some(
      (item) => item.status === DeliveryItemStatus.ISSUE
    );
    
    if (hasIssues) {
      return DeliveryStatus.ISSUE;
    }

    const someDelivered = this.items.some(
      (item) => item.status === DeliveryItemStatus.DELIVERED
    );
    
    if (someDelivered) {
      return DeliveryStatus.PARTIAL;
    }

    return DeliveryStatus.PENDING;
  }
}
