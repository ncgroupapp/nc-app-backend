import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Licitation } from '@/contexts/licitations/entities/licitation.entity';
import { Adjudication } from '@/contexts/adjudications/entities/adjudication.entity';

export enum DeliveryStatus {
  PENDING = 'pendiente_entrega',
  ON_WAY = 'en_camino',
  DELIVERED = 'entregado',
  ISSUE = 'problema_entrega',
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

  @Column({ type: 'int' })
  adjudicationId!: number;

  @ManyToOne(() => Adjudication)
  @JoinColumn({ name: 'adjudicationId' })
  adjudication!: Adjudication;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status!: DeliveryStatus;

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
