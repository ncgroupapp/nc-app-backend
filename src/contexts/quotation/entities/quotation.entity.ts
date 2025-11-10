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

// Enums para los estados
export enum QuotationAwardStatus {
  AWARDED = 'adjudicado',
  NOT_AWARDED = 'no_adjudicado',
  PENDING = 'en_espera',
}

export enum QuotationStatus {
  CREATED = 'creada',
  FINALIZED = 'finalizada',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  CLP = 'CLP',
  ARS = 'ARS',
  BRL = 'BRL',
  UYU = 'UYU',
}

// Entidad principal de Cotización - Declarada primero
@Entity('quotations')
export class Quotation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  quotationIdentifier!: string; // Identificador único de cotización

  @Column({ type: 'varchar', length: 255, nullable: true })
  associatedPurchase?: string; // Compra asociada

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.CREATED,
  })
  status!: QuotationStatus; // Estado de Cotización (Creada o Finalizada)

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  observations?: string;

  @OneToMany(() => QuotationItem, (item) => item.quotation, {
    cascade: true,
    eager: true,
  })
  items!: QuotationItem[];

  @Column({ type: 'date', nullable: true })
  quotationDate?: Date;

  @Column({ type: 'date', nullable: true })
  validUntil?: Date;

  @Column({ type: 'int', nullable: true })
  clientId?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientName?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// Entidad para los items individuales de la cotización - Declarada después
@Entity('quotation_items')
export class QuotationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  quotationId!: number;

  @Column({ type: 'int', nullable: true })
  productId?: number;

  @Column({ type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'varchar', length: 100 })
  sku!: string;

  @Column({ type: 'int', nullable: true })
  providerId?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerName?: string;

  @Column({ type: 'boolean', default: false })
  inStock!: boolean;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'int', nullable: true })
  deliveryTime?: number; // Días hábiles

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceWithoutIVA!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  priceWithIVA!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 })
  ivaPercentage!: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.CLP,
  })
  currency!: Currency;

  @Column({
    type: 'enum',
    enum: QuotationAwardStatus,
    default: QuotationAwardStatus.PENDING,
  })
  awardStatus!: QuotationAwardStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => Quotation, (quotation) => quotation.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quotationId' })
  quotation!: Quotation;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
