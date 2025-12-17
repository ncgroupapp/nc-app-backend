import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Provider } from '../../providers/entities/provider.entity';
import { Product } from '../../products/entities/product.entity';
import { Licitation } from '../../licitations/entities/licitation.entity';

@Entity('imports')
export class Import {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  folder!: string;

  @ManyToOne(() => Provider, { nullable: false })
  @JoinColumn({ name: 'providerId' })
  provider!: Provider;

  @Column()
  providerId!: number;

  @Column()
  transport!: string;

  @Column({ nullable: true })
  arbitrage?: string;

  @Column('decimal', { precision: 10, scale: 4 })
  exchangeRate!: number;

  @Column('int')
  packageCount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalWeight!: number;

  @Column()
  originCurrency!: string;

  @Column('date')
  importDate!: Date;

  @Column({
    type: 'varchar',
    default: 'En Tránsito',
  })
  status!: string;

  @ManyToMany(() => Product)
  @JoinTable({
    name: 'import_products',
    joinColumn: { name: 'importId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'productId', referencedColumnName: 'id' },
  })
  products!: Product[];

  @ManyToMany(() => Licitation)
  @JoinTable({
    name: 'import_licitations',
    joinColumn: { name: 'importId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'licitationId', referencedColumnName: 'id' },
  })
  licitations!: Licitation[];

  // Cost Structure A: Base Costs
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  fobOrigin!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  fobUsd!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  freightOrigin!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  freightUsd!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  insuranceOrigin!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  insuranceUsd!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  cif!: number;

  // Cost Structure B: Tributos Oficiales Exentos de IVA
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  advanceVatRate!: number; // Percentage

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  advanceVat!: number; // Calculated amount

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  transitGuideRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  transitGuide!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  imaduniRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  imaduni!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  vatRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  vat!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  surchargeRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  surcharge!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  consularFeesRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  consularFees!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  tcuRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tcu!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  auriStampsRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  auriStamps!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  tsaRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tsa!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  bankCharges!: number; // Fixed amount

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotalA!: number;

  // Cost Structure C: Otros Pagos Exentos de IVA
  @Column('jsonb', { nullable: true })
  otherExemptPayments?: Record<string, number>;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotalB!: number;

  // Cost Structure D: Pagos Gravados de IVA
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  dispatchExpensesRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  dispatchExpenses!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  customsSurchargeRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  customsSurcharge!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  feesRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  fees!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  externalFreightRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  externalFreight!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  insuranceTaxRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  insuranceTax!: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  internalFreightRate!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  internalFreight!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  vatSubject!: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotalC!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
