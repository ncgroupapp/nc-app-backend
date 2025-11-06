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
  EN_ESPERA = "En espera",
  ADJUDICACION_PARCIAL = "Adjudicación Parcial",
  NO_ADJUDICADA = "No Adjudicada",
  ADJUDICACION_TOTAL = "Adjudicación Total",
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
    default: LicitationStatus.EN_ESPERA,
  })
  status!: LicitationStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

