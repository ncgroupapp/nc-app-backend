import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  deliveryId!: number;

  @ManyToOne('Delivery', 'invoices', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deliveryId' })
  delivery!: any;

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
