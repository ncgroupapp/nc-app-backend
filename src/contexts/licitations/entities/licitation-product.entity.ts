import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Product } from "@/contexts/products/entities/product.entity";
import type { Licitation } from "./licitation.entity";

@Entity("licitation_products")
export class LicitationProduct {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne("Licitation", "licitationProducts", {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "licitationId" })
  licitation!: Licitation;

  @Column({ name: "licitationId" })
  licitationId!: number;

  @ManyToOne(() => Product, { eager: true })
  @JoinColumn({ name: "productId" })
  product!: Product;

  @Column({ name: "productId" })
  productId!: number;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
