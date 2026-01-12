import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quotation } from '@/contexts/quotation/entities/quotation.entity';
import { Licitation } from '@/contexts/licitations/entities/licitation.entity';
import { Product } from '@/contexts/products/entities/product.entity';

export enum AdjudicationStatus {
  TOTAL = 'total',
  PARTIAL = 'parcial',
}

@Entity('adjudications')
export class Adjudication {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  quotationId!: number;

  @ManyToOne(() => Quotation)
  @JoinColumn({ name: 'quotationId' })
  quotation!: Quotation;

  @Column({ type: 'int' })
  licitationId!: number;

  @ManyToOne(() => Licitation)
  @JoinColumn({ name: 'licitationId' })
  licitation!: Licitation;

  @Column({
    type: 'enum',
    enum: AdjudicationStatus,
    default: AdjudicationStatus.TOTAL,
  })
  status!: AdjudicationStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPriceWithoutIVA!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPriceWithIVA!: number;

  @Column({ type: 'int', default: 0 })
  totalQuantity!: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  adjudicationDate!: Date;

  @OneToMany(() => AdjudicationItem, (item: AdjudicationItem) => item.adjudication, {
    cascade: true,
    eager: true,
  })
  items!: AdjudicationItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('adjudication_items')
export class AdjudicationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  adjudicationId!: number;

  @ManyToOne(() => Adjudication, (adjudication) => adjudication.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'adjudicationId' })
  adjudication!: Adjudication;

  @Column({ type: 'int', nullable: true })
  productId?: number;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: Product;



  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
