import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/** A company certificate with an expiry date (DGI, BPS, BSE...) and its scanned file. */
@Entity("certificates")
export class Certificate {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Set for the built-in RUPE certificates, null for the ones added by hand */
  @Column({ type: "varchar", length: 30, nullable: true, unique: true })
  code!: string | null;

  @Column({ type: "varchar", length: 150 })
  name!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  issuer!: string | null;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "boolean", default: false })
  requiredForRupe!: boolean;

  @Column({ type: "date", nullable: true })
  issueDate!: string | null;

  @Column({ type: "date", nullable: true })
  expiryDate!: string | null;

  /** How many days before the expiry date it starts showing as "por vencer" */
  @Column({ type: "int", default: 30 })
  alertDays!: number;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  fileName!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  mimeType!: string | null;

  @Column({ type: "int", nullable: true })
  fileSize!: number | null;

  @Column({ type: "bytea", nullable: true, select: false })
  fileData!: Buffer | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
