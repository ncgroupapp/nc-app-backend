import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from "typeorm";
import { Client } from "@/contexts/clients/entities/client.entity";
import { Product } from "@/contexts/products/entities/product.entity";

export enum LicitationStatus {
  PENDING = "Pending",
  PARTIAL_ADJUDICATION = "Partial Adjudication",
  NOT_ADJUDICATED = "Not Adjudicated",
  TOTAL_ADJUDICATION = "Total Adjudication",
}

@Entity("licitations")
export class Licitation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "date" })
  startDate!: Date;

  @Column({ type: "date" })
  deadlineDate!: Date;

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: "clientId" })
  client!: Client;

  @Column({ name: "clientId" })
  clientId!: number;

  @Column({ type: "varchar", length: 255 })
  callNumber!: string;

  @Column({ type: "varchar", length: 255 })
  internalNumber!: string;

  @ManyToMany(() => Product, { eager: false })
  @JoinTable({
    name: "licitation_products",
    joinColumn: { name: "licitationId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "productId", referencedColumnName: "id" },
  })
  products?: Product[];

  @Column({
    type: "enum",
    enum: LicitationStatus,
    default: LicitationStatus.PENDING,
  })
  status!: LicitationStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

