import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Product } from "@/contexts/products/entities/product.entity";
import { Provider } from "@/contexts/providers/entities/provider.entity";

@Entity("offers")
export class Offer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  name?: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ type: "date" })
  deliveryDate!: Date;

  @Column({ type: "varchar", length: 100, nullable: true })
  origin?: string;

  @Column({ type: "int" })
  quantity!: number;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: "productId" })
  product!: Product;

  @Column({ name: "productId" })
  productId!: number;

  @ManyToOne(() => Provider, { nullable: false })
  @JoinColumn({ name: "providerId" })
  provider!: Provider;

  @Column({ name: "providerId" })
  providerId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

