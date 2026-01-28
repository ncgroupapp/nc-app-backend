import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Client } from "@/contexts/clients/entities/client.entity";
import { Quotation } from "@/contexts/quotation/entities/quotation.entity";
import type { LicitationProduct } from "./licitation-product.entity";

export enum LicitationStatus {
  PENDING = "Pending",
  QUOTED = "Quoted",
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

  @OneToMany("LicitationProduct", "licitation", {
    cascade: true,
    eager: false,
  })
  licitationProducts?: LicitationProduct[];

  @OneToMany(() => Quotation, (quotation) => quotation.licitation)
  quotations?: Quotation[];

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
