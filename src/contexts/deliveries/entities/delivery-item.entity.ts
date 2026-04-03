import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Delivery } from './delivery.entity';

export enum DeliveryItemStatus {
  PENDING = 'pendiente_entrega',
  ON_WAY = 'en_camino',
  DELIVERED = 'entregado',
  ISSUE = 'problema_entrega',
}

@Entity('delivery_items')
export class DeliveryItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  deliveryId!: number;

  @ManyToOne(() => Delivery, (delivery) => delivery.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deliveryId' })
  delivery!: Delivery;

  @Column({ type: 'int', nullable: true })
  adjudicationId?: number;

  @Column({ type: 'int', nullable: true })
  productId?: number;

  @Column({ type: 'varchar', length: 100 })
  productCode!: string;

  @Column({ type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({
    type: 'enum',
    enum: DeliveryItemStatus,
    default: DeliveryItemStatus.PENDING,
  })
  status!: DeliveryItemStatus;

  @Column({ type: 'date' })
  estimatedDate!: Date;

  @Column({ type: 'date', nullable: true })
  actualDate?: Date;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
