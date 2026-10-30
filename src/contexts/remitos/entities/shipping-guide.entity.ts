import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

/** "Datos de envío" label stuck on a package (printed two per A4 landscape sheet). */
@Entity("shipping_guides")
export class ShippingGuide {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 255 })
  recipientName!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  recipientPhone?: string | null;

  /** Up to three address lines, e.g. "RETIRA EN AGENCIA DAC", "DEPARTAMENTO SALTO". */
  @Column({ type: "jsonb", default: () => "'[]'" })
  addressLines!: string[];

  @Column({ type: "varchar", length: 255, default: "NC GROUP SAS" })
  senderName!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  senderPhone?: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  senderRut?: string | null;

  @Column({ type: "int", nullable: true })
  clientId?: number | null;

  @Column({ type: "int", nullable: true })
  remitoId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
