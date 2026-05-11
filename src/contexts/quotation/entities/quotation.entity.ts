import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Licitation } from "@/contexts/licitations/entities/licitation.entity";
import { Currency } from "@/contexts/shared/enums/currency.enum";
import { Product } from "../../products/entities/product.entity";

// Enums para los estados
export enum QuotationAwardStatus {
  AWARDED = "adjudicado",
  PARTIALLY_AWARDED = "adjudicado_parcialmente",
  NOT_AWARDED = "no_adjudicado",
  PENDING = "en_espera",
}

export enum QuotationStatus {
  CREATED = "creada",
  FINALIZED = "finalizada",
}

// Entidad principal de Cotización
@Entity("quotations")
export class Quotation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  quotationIdentifier!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  associatedPurchase?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  observations?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  clientName?: string;

  @Column({ type: "int", nullable: true })
  clientId?: number;

  @Column({ type: "timestamp", nullable: true })
  quotationDate?: Date;

  @Column({ type: "timestamp", nullable: true })
  validUntil?: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  paymentForm?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  validity?: string;

  @Column({
    type: "enum",
    enum: QuotationStatus,
    default: QuotationStatus.CREATED,
  })
  status!: QuotationStatus;

  @ManyToOne(() => Licitation, licitation => licitation.quotations, {
    nullable: true,
  })
  @JoinColumn({ name: "licitationId" })
  licitation?: Licitation;

  @Column({ nullable: true })
  licitationId?: number;

  @OneToMany(() => QuotationItem, item => item.quotation, { cascade: true })
  items!: QuotationItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

// Entidad para los ítems de la cotización
@Entity("quotation_items")
export class QuotationItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Quotation, quotation => quotation.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "quotationId" })
  quotation!: Quotation;

  @Column()
  quotationId!: number;

  @Column({ type: "varchar", length: 255 })
  productName!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  brand?: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  origin?: string;

  @Column({ type: "int", nullable: true })
  providerId?: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  providerName?: string;

  @Column({ type: "boolean", default: false })
  inStock!: boolean;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: "int", nullable: true })
  deliveryTime?: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  priceWithoutIVA!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  priceWithIVA!: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 19 })
  ivaPercentage!: number;

  @Column({
    type: "enum",
    enum: Currency,
    default: Currency.CLP,
  })
  currency!: Currency;

  @Column({
    type: "enum",
    enum: QuotationAwardStatus,
    default: QuotationAwardStatus.PENDING,
  })
  awardStatus!: QuotationAwardStatus;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  awardedQuantity?: number;

  @Column({ type: "jsonb", nullable: true })
  competitorInfo?: {
    winnerName: string;
    winnerPrice: number;
    notes?: string;
  };

  @Column({ type: "text", nullable: true })
  notes?: string;

  @ManyToOne(() => Product, {
    nullable: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Column({ nullable: true })
  productId?: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
