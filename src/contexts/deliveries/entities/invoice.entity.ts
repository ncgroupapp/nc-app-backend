import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Delivery } from './delivery.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  deliveryId!: number;

  @ManyToOne(() => Delivery, (delivery) => delivery.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deliveryId' })
  delivery!: Relation<Delivery>;

  @Column({ type: 'varchar', length: 100 })
  invoiceNumber!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl?: string;

  @Column({ type: 'date' })
  issueDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
