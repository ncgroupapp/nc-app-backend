import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Relation,
} from "typeorm";
import { decimalTransformer } from "./decimal.transformer";

export enum RemitoStatus {
  ISSUED = "emitido",
  DELIVERED = "entregado",
  CANCELLED = "anulado",
}

/** Delivery note (no prices) for products handed to a client. Not a DGI electronic receipt (CFE). */
@Entity("remitos")
export class Remito {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Correlative number shown on the PDF (000001, 000002…), never reused. */
  @Column({ type: "int", unique: true })
  number!: number;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "int", nullable: true })
  clientId?: number | null;

  @Column({ type: "int", nullable: true })
  licitationId?: number | null;

  @Column({ type: "varchar", length: 255 })
  receiverName!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  receiverRut?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  receiverAddress?: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  receiverCity?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  receiverPhone?: string | null;

  /** Client's purchase order (e.g. D190541001). */
  @Column({ type: "varchar", length: 100, nullable: true })
  purchaseOrder?: string | null;

  /** Free reference, e.g. the licitation number. */
  @Column({ type: "varchar", length: 255, nullable: true })
  reference?: string | null;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @Column({ type: "varchar", length: 20, default: RemitoStatus.ISSUED })
  status!: RemitoStatus;

  @Column({ type: "date", nullable: true })
  deliveredAt?: string | null;

  @OneToMany(() => RemitoItem, (item) => item.remito, { cascade: true, eager: true })
  items!: Relation<RemitoItem>[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity("remito_items")
export class RemitoItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  remitoId!: number;

  @ManyToOne(() => Remito, (remito) => remito.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "remitoId" })
  remito!: Relation<Remito>;

  @Column({ type: "int", default: 0 })
  position!: number;

  @Column({ type: "int", nullable: true })
  productId?: number | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  code?: string | null;

  @Column({ type: "varchar", length: 500 })
  description!: string;

  @Column({ type: "numeric", precision: 12, scale: 2, transformer: decimalTransformer })
  quantity!: number;
}
