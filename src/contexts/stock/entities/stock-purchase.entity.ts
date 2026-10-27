import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Product } from "../../products/entities/product.entity";
import { Provider } from "../../providers/entities/provider.entity";

/**
 * Compra de mercadería de un producto: a quién se compró, cuándo y a qué costo.
 * Es informativa: no modifica el stock del producto.
 */
@Entity("stock_purchases")
@Index(["productId"])
export class StockPurchase {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product?: Product;

  @Column({ type: "int" })
  productId!: number;

  @ManyToOne(() => Provider, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "providerId" })
  provider?: Provider | null;

  @Column({ type: "int", nullable: true })
  providerId?: number | null;

  /** Nombre del proveedor tal como se registró (o texto libre si no está dado de alta). */
  @Column({ type: "varchar", length: 255, nullable: true })
  providerName?: string | null;

  @Column({ type: "date", nullable: true })
  purchaseDate?: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  orderNumber?: string | null;

  @Column({ type: "numeric", precision: 10, scale: 2 })
  quantity!: number;

  @Column({ type: "numeric", precision: 12, scale: 2 })
  unitCost!: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency!: string;

  @Column({ type: "text", nullable: true })
  notes?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
